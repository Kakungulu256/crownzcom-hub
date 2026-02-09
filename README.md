# SACCO Management System

A comprehensive web application for managing SACCO (Savings and Credit Cooperative Organization) operations, built with React.js and Appwrite.

## Features

### Admin Features
- **Member Management**: Create and manage member accounts
- **Savings Management**: Record monthly savings contributions
- **Loan Management**: Review and approve loan applications
- **Reports**: Generate comprehensive financial reports
- **Dashboard**: Overview of key metrics and activities

### Member Features
- **Personal Dashboard**: View savings, loans, and eligibility
- **Loan Applications**: Apply for loans with custom repayment plans
- **Savings History**: Track contribution history
- **Reports**: Download personal financial statements

## Technology Stack

- **Frontend**: React.js 18 with Vite
- **Styling**: Tailwind CSS
- **Backend**: Appwrite (Backend-as-a-Service)
- **Authentication**: Appwrite Auth
- **Database**: Appwrite Databases
- **Forms**: React Hook Form
- **Notifications**: React Hot Toast
- **Icons**: Heroicons

## Business Rules

### Savings
- Monthly contributions recorded by admin
- Forms basis for loan eligibility calculation

### Loans
- **Eligibility**: Maximum 80% of total savings
- **Duration**: 1-6 months (short-term only)
- **Interest**: 2% of principal per month
- **Early Repayment**: Additional 1% interest for that month
- **Repayment Options**: Equal installments or custom payments

## Setup Instructions

### 1. Prerequisites
- Node.js 16+ installed
- Appwrite account (cloud.appwrite.io) OR self-hosted Appwrite instance

### 2. Appwrite Setup

**For Cloud Appwrite (cloud.appwrite.io):**
1. **Create Project**:
   - Go to [Appwrite Console](https://cloud.appwrite.io)
   - Create a new project
   - Copy the Project ID

**For Self-Hosted Appwrite:**
1. **Setup Appwrite Instance**:
   - Follow [Appwrite self-hosting guide](https://appwrite.io/docs/self-hosting)
   - Access your Appwrite console at `http://your-domain/console`
   - Create a new project
   - Copy the Project ID

2. **Create Database**:
   - Create a new database named `sacco-db`
   - Copy the Database ID

3. **Create Collections**:
   Create the following collections with these attributes:

   **Members Collection** (`members`):
   ```
   - name (string, required)
   - email (email, required, unique)
   - phone (string, required)
   - membershipNumber (string, required, unique)
   - joinDate (datetime, required)
   - status (string, required, default: "active")
   ```
   **Relationships**: One-to-Many with Savings (two-way), Loans (two-way), Subscriptions (one-way), Interest Allocations (one-way)

   **Savings Collection** (`savings`):
   ```
   - memberId (string, required) - Many-to-One relationship to members
   - amount (integer, required) - amount in UGX
   - month (string, required) - format: YYYY-MM
   - createdAt (datetime, required)
   ```
   **Relationships**: Many-to-One with Members (two-way)

   **Loans Collection** (`loans`):
   ```
   - memberId (string, required) - Many-to-One relationship to members
   - amount (integer, required) - amount in UGX
   - duration (integer, required) - months
   - purpose (string, required)
   - repaymentType (string, required) - "equal" or "custom"
   - repaymentPlan (string, required) - JSON array
   - status (string, required) - "pending", "approved", "active", "completed", "rejected"
   - createdAt (datetime, required)
   - approvedAt (datetime, optional)
   - rejectedAt (datetime, optional)
   - balance (integer, optional) - remaining balance
   ```
   **Relationships**: Many-to-One with Members (two-way), One-to-Many with Loan Repayments (one-way) and Loan Charges (one-way)

   **Loan Repayments Collection** (`loan_repayments`):
   ```
   - loanId (string, required) - Many-to-One relationship to loans
   - amount (integer, required) - amount in UGX
   - month (integer, required) - repayment month number
   - paidAt (datetime, required)
   - isEarlyPayment (boolean, default: false)
   ```
   **Relationships**: Many-to-One with Loans (one-way)

   **Loan Charges Collection** (`loan_charges`):
   ```
   - loanId (string, required) - Many-to-One relationship to loans
   - description (string, required)
   - amount (integer, required) - amount in UGX
   - createdAt (datetime, required)
   ```
   **Relationships**: Many-to-One with Loans (one-way)

   **Subscriptions Collection** (`subscriptions`):
   ```
   - memberId (string, required) - Many-to-One relationship to members
   - amount (integer, required) - amount in UGX
   - month (string, required) - format: YYYY-MM
   - createdAt (datetime, required)
   ```
   **Relationships**: Many-to-One with Members (one-way)

   **Expenses Collection** (`expenses`):
   ```
   - description (string, required)
   - amount (integer, required) - amount in UGX
   - category (string, required)
   - date (datetime, required)
   - createdAt (datetime, required)
   ```
   **Relationships**: None (standalone collection)

   **Unit Trust Collection** (`unit_trust`):
   ```
   - type (string, required) - "purchase", "withdrawal", "interest"
   - amount (integer, required) - amount in UGX
   - description (string, required)
   - date (datetime, required)
   - createdAt (datetime, required)
   ```
   **Relationships**: None (standalone collection)

   **Interest Allocations Collection** (`interest_allocations`):
   ```
   - memberId (string, required) - Many-to-One relationship to members
   - loanInterest (integer, required) - from loan interest
   - unitTrustInterest (integer, required) - from unit trust
   - totalInterest (integer, required) - total allocated
   - month (string, required) - format: YYYY-MM
   - createdAt (datetime, required)
   ```
   **Relationships**: Many-to-One with Members (one-way)

4. **Set Permissions**:
   - For each collection, set appropriate read/write permissions
   - Admin users should have full access
   - Members should only access their own records

5. **Create Admin User**:
   - Go to Auth section
   - Create a user account for admin
   - Add label `admin` to the user account

6. **Deploy Appwrite Function** (Required for member creation with auth):
   
   **For Cloud Appwrite:**
   ```bash
   # Install Appwrite CLI
   npm install -g appwrite-cli
   
   # Login to Appwrite
   appwrite login
   
   # Initialize project (if not done)
   appwrite init project
   
   # Deploy the function
   cd functions/create-member
   appwrite deploy function
   ```
   
   **For Self-Hosted Appwrite:**
   
   *Note: Self-hosted Appwrite may have limited Functions support. Use manual approach:*
   
   - Go to Functions section in Appwrite Console
   - Create a new function named `create-member`
   - Set Runtime to `Node.js 18.0`
   - Upload the function code from `functions/create-member/`
   - If Functions are not available, members will be created in database only
   - Auth accounts must be created manually through the console
   
   **Set Environment Variables** (if Functions are supported):
   ```
   APPWRITE_FUNCTION_ENDPOINT=http://your-domain/v1
   APPWRITE_FUNCTION_PROJECT_ID=your-project-id
   APPWRITE_API_KEY=your-server-api-key
   DATABASE_ID=your-database-id
   MEMBERS_COLLECTION_ID=your-members-collection-id
   ```
   
   **Create Server API Key**:
   - Go to Settings > API Keys in Appwrite Console
   - Create new API key with `users.write` and `databases.write` scopes
   - Copy the key for APPWRITE_API_KEY environment variable

### 3. Project Setup

1. **Clone and Install**:
   ```bash
   git clone <repository-url>
   cd sacco-management-system
   npm install
   ```

2. **Environment Configuration**:
   ```bash
   cp .env.example .env
   ```
   
   Update `.env` with your Appwrite details:
   
   **For Cloud Appwrite:**
   ```
   VITE_APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
   VITE_APPWRITE_PROJECT_ID=your-project-id
   VITE_APPWRITE_DATABASE_ID=your-database-id
   ```
   
   **For Self-Hosted Appwrite:**
   ```
   VITE_APPWRITE_ENDPOINT=http://your-domain/v1
   VITE_APPWRITE_PROJECT_ID=your-project-id
   VITE_APPWRITE_DATABASE_ID=your-database-id
   ```

3. **Start Development Server**:
   ```bash
   npm run dev
   ```

4. **Access Application**:
   - Open http://localhost:3000
   - Login with admin credentials to access admin features
   - Create member accounts through admin panel

## Usage Guide

### Admin Workflow

1. **Initial Setup**:
   - Login as admin
   - Create member accounts with initial passwords
   - Set up member details and membership numbers

2. **Monthly Operations**:
   - Record member savings contributions
   - Review and approve loan applications
   - Add loan charges (bank fees, etc.)
   - Generate monthly reports

3. **Loan Management**:
   - Review loan applications for eligibility
   - Approve/reject based on savings and business rules
   - Add processing charges and fees
   - Monitor active loans and repayments

### Member Workflow

1. **Login**: Use credentials provided by admin
2. **View Dashboard**: Check savings, loan eligibility, and status
3. **Apply for Loans**: Submit applications with repayment preferences
4. **Track Progress**: Monitor loan status and repayment schedules
5. **Download Reports**: Get personal financial statements

## Financial Calculations

### Loan Eligibility
```javascript
maxLoanAmount = totalSavings * 0.80
```

### Monthly Interest
```javascript
monthlyInterest = loanPrincipal * 0.02
```

### Early Repayment Penalty
```javascript
earlyRepaymentInterest = loanPrincipal * 0.01
```

## Database Relationships

### Relationship Summary

| Collection | Relationship Type | Target Collection | Cardinality | Direction |
|------------|------------------|-------------------|-------------|----------|
| Members | One-to-Many | Savings | 1:N | Two-way |
| Members | One-to-Many | Loans | 1:N | Two-way |
| Members | One-to-Many | Subscriptions | 1:N | One-way |
| Members | One-to-Many | Interest Allocations | 1:N | One-way |
| Loans | One-to-Many | Loan Repayments | 1:N | One-way |
| Loans | One-to-Many | Loan Charges | 1:N | One-way |
| Expenses | None | - | - | Standalone |
| Unit Trust | None | - | - | Standalone |

### Relationship Details

**One-to-Many Relationships:**
- **Members → Savings**: One member can have multiple savings records (two-way: members query their savings)
- **Members → Loans**: One member can have multiple loans over time (two-way: members query their loans)
- **Members → Subscriptions**: One member can have multiple subscription payments (one-way: admin-only access)
- **Members → Interest Allocations**: One member can receive multiple interest allocations (one-way: admin-only access)
- **Loans → Loan Repayments**: One loan can have multiple repayment records (one-way: admin manages repayments)
- **Loans → Loan Charges**: One loan can have multiple associated charges (one-way: admin manages charges)

**Standalone Collections:**
- **Expenses**: Independent operational expenses
- **Unit Trust**: Independent investment transactions

## Security Features

- Role-based access control
- Member data isolation
- Server-side financial calculations
- Audit trail for all transactions
- Secure authentication with Appwrite

## Development

### Project Structure
```
src/
├── components/
│   ├── admin/          # Admin-only components
│   ├── member/         # Member-only components
│   └── shared/         # Shared components
├── lib/
│   ├── appwrite.js     # Appwrite configuration
│   └── auth.jsx        # Authentication context
├── pages/              # Main page components
├── utils/              # Utility functions
└── hooks/              # Custom React hooks
```

### Key Files
- `src/lib/appwrite.js`: Appwrite client configuration
- `src/lib/auth.jsx`: Authentication context and user management
- `src/utils/financial.js`: Financial calculation utilities
- `src/App.jsx`: Main application with routing

## Deployment

### Build for Production
```bash
npm run build
```

### Deploy to Vercel/Netlify
1. Connect your repository
2. Set environment variables
3. Deploy the `dist` folder

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Support

For issues and questions:
1. Check the documentation
2. Review Appwrite console for configuration issues
3. Verify environment variables
4. Check browser console for errors

## License

This project is licensed under the MIT License.

## Roadmap

### Phase 2 Features
- Mobile application
- Payment gateway integration
- Long-term loan products
- Advanced reporting and analytics
- Member self-registration
- SMS/Email notifications
- Regulatory compliance reporting

---

**Note**: This system is designed for small to medium SACCOs. For larger organizations or regulatory compliance, additional features and security measures may be required.