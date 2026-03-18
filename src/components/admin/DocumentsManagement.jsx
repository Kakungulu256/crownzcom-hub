import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { ID } from 'appwrite';
import { databases, storage, DATABASE_ID, COLLECTIONS, DOCUMENTS_BUCKET_ID } from '../../lib/appwrite';
import { listAllDocuments } from '../../lib/pagination';
import { useAuth } from '../../lib/auth';

const DocumentsManagement = () => {
  const { user } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [categoryLoading, setCategoryLoading] = useState(false);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');
  const [docForm, setDocForm] = useState({
    title: '',
    category: '',
    period: '',
    tags: '',
    notes: '',
    file: null
  });
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    description: ''
  });
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [editingCategoryForm, setEditingCategoryForm] = useState({
    name: '',
    description: ''
  });

  const loadDocuments = async () => {
    if (!COLLECTIONS.DOCUMENTS) return;
    const docs = await listAllDocuments(databases, DATABASE_ID, COLLECTIONS.DOCUMENTS);
    setDocuments(docs);
  };

  const loadCategories = async () => {
    if (!COLLECTIONS.DOCUMENT_CATEGORIES) return;
    const cats = await listAllDocuments(databases, DATABASE_ID, COLLECTIONS.DOCUMENT_CATEGORIES);
    setCategories(cats);
  };

  const fetchData = async () => {
    try {
      await Promise.all([loadDocuments(), loadCategories()]);
    } catch (error) {
      toast.error('Failed to load documents data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredDocuments = useMemo(() => {
    if (selectedCategoryFilter === 'all') return documents;
    return documents.filter((doc) => doc.category === selectedCategoryFilter);
  }, [documents, selectedCategoryFilter]);

  const handleFileChange = (event) => {
    const file = event.target.files?.[0] || null;
    setDocForm((prev) => ({ ...prev, file }));
  };

  const resetDocForm = () => {
    setDocForm({
      title: '',
      category: '',
      period: '',
      tags: '',
      notes: '',
      file: null
    });
  };

  const uploadDocument = async () => {
    if (!docForm.title || !docForm.category || !docForm.file) {
      toast.error('Title, category, and file are required.');
      return;
    }
    if (!COLLECTIONS.DOCUMENTS) {
      toast.error('Documents collection is not configured.');
      return;
    }

    try {
      setUploading(true);
      const fileUpload = await storage.createFile(
        DOCUMENTS_BUCKET_ID,
        ID.unique(),
        docForm.file
      );

      const payload = {
        title: docForm.title.trim(),
        category: docForm.category,
        fileId: fileUpload.$id,
        bucketId: DOCUMENTS_BUCKET_ID,
        uploadedBy: user?.$id || '',
        uploadedAt: new Date().toISOString(),
        tags: docForm.tags?.trim() || '',
        period: docForm.period?.trim() || '',
        notes: docForm.notes?.trim() || ''
      };

      await databases.createDocument(
        DATABASE_ID,
        COLLECTIONS.DOCUMENTS,
        ID.unique(),
        payload
      );

      toast.success('Document uploaded');
      resetDocForm();
      await loadDocuments();
    } catch (error) {
      toast.error(error.message || 'Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

  const deleteDocument = async (doc) => {
    if (!doc?.$id) return;
    if (!confirm('Delete this document?')) return;
    try {
      await databases.deleteDocument(DATABASE_ID, COLLECTIONS.DOCUMENTS, doc.$id);
      if (doc.fileId) {
        await storage.deleteFile(doc.bucketId || DOCUMENTS_BUCKET_ID, doc.fileId);
      }
      toast.success('Document deleted');
      await loadDocuments();
    } catch (error) {
      toast.error('Failed to delete document');
    }
  };

  const addCategory = async () => {
    if (!categoryForm.name.trim()) {
      toast.error('Category name is required.');
      return;
    }
    if (!COLLECTIONS.DOCUMENT_CATEGORIES) {
      toast.error('Document categories collection is not configured.');
      return;
    }
    try {
      setCategoryLoading(true);
      await databases.createDocument(
        DATABASE_ID,
        COLLECTIONS.DOCUMENT_CATEGORIES,
        ID.unique(),
        {
          name: categoryForm.name.trim(),
          description: categoryForm.description?.trim() || '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      );
      toast.success('Category added');
      setCategoryForm({ name: '', description: '' });
      await loadCategories();
    } catch (error) {
      toast.error(error.message || 'Failed to add category');
    } finally {
      setCategoryLoading(false);
    }
  };

  const startEditCategory = (category) => {
    setEditingCategoryId(category.$id);
    setEditingCategoryForm({
      name: category.name || '',
      description: category.description || ''
    });
  };

  const saveCategoryEdit = async () => {
    if (!editingCategoryId) return;
    try {
      setCategoryLoading(true);
      await databases.updateDocument(
        DATABASE_ID,
        COLLECTIONS.DOCUMENT_CATEGORIES,
        editingCategoryId,
        {
          name: editingCategoryForm.name.trim(),
          description: editingCategoryForm.description?.trim() || '',
          updatedAt: new Date().toISOString()
        }
      );
      toast.success('Category updated');
      setEditingCategoryId(null);
      await loadCategories();
    } catch (error) {
      toast.error('Failed to update category');
    } finally {
      setCategoryLoading(false);
    }
  };

  const deleteCategory = async (category) => {
    if (!category?.$id) return;
    if (!confirm('Delete this category?')) return;
    try {
      await databases.deleteDocument(DATABASE_ID, COLLECTIONS.DOCUMENT_CATEGORIES, category.$id);
      toast.success('Category deleted');
      await loadCategories();
    } catch (error) {
      toast.error('Failed to delete category');
    }
  };

  const getFileUrl = (doc) => {
    if (!doc?.fileId) return '';
    return storage.getFileView(doc.bucketId || DOCUMENTS_BUCKET_ID, doc.fileId);
  };

  if (loading) {
    return <div className="animate-pulse">Loading documents...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Documents</h2>
        <p className="mt-1 text-sm text-gray-600">
          Store and retrieve unit trust statements, contract notes, invoices, and bank statements.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Upload Document</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <input
                type="text"
                value={docForm.title}
                onChange={(e) => setDocForm((prev) => ({ ...prev, title: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select
                value={docForm.category}
                onChange={(e) => setDocForm((prev) => ({ ...prev, category: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              >
                <option value="">Select category</option>
                {categories.map((category) => (
                  <option key={category.$id} value={category.name}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Period</label>
              <input
                type="text"
                value={docForm.period}
                onChange={(e) => setDocForm((prev) => ({ ...prev, period: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                placeholder="e.g. 2026-03"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
              <input
                type="text"
                value={docForm.tags}
                onChange={(e) => setDocForm((prev) => ({ ...prev, tags: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                placeholder="comma separated"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                value={docForm.notes}
                onChange={(e) => setDocForm((prev) => ({ ...prev, notes: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                rows={3}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">File</label>
              <input
                type="file"
                onChange={handleFileChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
            </div>
            <button
              type="button"
              onClick={uploadDocument}
              disabled={uploading}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {uploading ? 'Uploading...' : 'Upload Document'}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Manage Categories</h3>
          <div className="space-y-3 mb-6">
            <input
              type="text"
              value={categoryForm.name}
              onChange={(e) => setCategoryForm((prev) => ({ ...prev, name: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
              placeholder="Category name"
            />
            <textarea
              value={categoryForm.description}
              onChange={(e) => setCategoryForm((prev) => ({ ...prev, description: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
              rows={2}
              placeholder="Description (optional)"
            />
            <button
              type="button"
              onClick={addCategory}
              disabled={categoryLoading}
              className="bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-slate-800 disabled:opacity-50"
            >
              Add Category
            </button>
          </div>

          <div className="space-y-3">
            {categories.map((category) => (
              <div key={category.$id} className="border border-gray-200 rounded-lg p-3">
                {editingCategoryId === category.$id ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={editingCategoryForm.name}
                      onChange={(e) => setEditingCategoryForm((prev) => ({ ...prev, name: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    />
                    <textarea
                      value={editingCategoryForm.description}
                      onChange={(e) => setEditingCategoryForm((prev) => ({ ...prev, description: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                      rows={2}
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={saveCategoryEdit}
                        className="bg-blue-600 text-white px-3 py-1 rounded-md"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingCategoryId(null)}
                        className="bg-gray-200 text-gray-700 px-3 py-1 rounded-md"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{category.name}</p>
                      <p className="text-xs text-gray-500">{category.description || 'No description'}</p>
                    </div>
                    <div className="flex gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => startEditCategory(category)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteCategory(category)}
                        className="text-red-600 hover:text-red-800"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {categories.length === 0 && (
              <div className="text-sm text-gray-500">No categories yet.</div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Documents Summary</h3>
          <div className="space-y-3 text-sm text-gray-600">
            <div className="flex justify-between">
              <span>Total Documents</span>
              <span className="font-semibold text-gray-900">{documents.length}</span>
            </div>
            <div className="flex justify-between">
              <span>Total Categories</span>
              <span className="font-semibold text-gray-900">{categories.length}</span>
            </div>
            <div className="flex justify-between">
              <span>Latest Upload</span>
              <span className="font-semibold text-gray-900">
                {documents[0]?.uploadedAt ? new Date(documents[0].uploadedAt).toLocaleDateString() : '-'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
          <h3 className="text-lg font-medium text-gray-900">Stored Documents</h3>
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-600">Filter</label>
            <select
              value={selectedCategoryFilter}
              onChange={(e) => setSelectedCategoryFilter(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="all">All categories</option>
              {categories.map((category) => (
                <option key={category.$id} value={category.name}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Title
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Period
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Uploaded
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredDocuments.map((doc) => (
                <tr key={doc.$id}>
                  <td className="px-4 py-2 text-sm text-gray-900">{doc.title}</td>
                  <td className="px-4 py-2 text-sm text-gray-500">{doc.category}</td>
                  <td className="px-4 py-2 text-sm text-gray-500">{doc.period || '-'}</td>
                  <td className="px-4 py-2 text-sm text-gray-500">
                    {doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString() : '-'}
                  </td>
                  <td className="px-4 py-2 text-right text-sm">
                    <div className="flex justify-end gap-3">
                      <a
                        href={getFileUrl(doc)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 hover:text-blue-800"
                      >
                        View
                      </a>
                      <button
                        type="button"
                        onClick={() => deleteDocument(doc)}
                        className="text-red-600 hover:text-red-800"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredDocuments.length === 0 && (
            <div className="text-center text-sm text-gray-500 py-6">No documents found.</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DocumentsManagement;
