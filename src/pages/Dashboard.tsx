import { AppLayout } from "@/components/layout/AppLayout";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { SavingsChart } from "@/components/dashboard/SavingsChart";
import { LoanRepaymentChart } from "@/components/dashboard/LoanRepaymentChart";
import { RecentTransactions } from "@/components/dashboard/RecentTransactions";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { Wallet, PiggyBank, CreditCard, TrendingUp } from "lucide-react";

const Dashboard = () => {
  return (
    <AppLayout title="Dashboard">
      <div className="space-y-6">
        {/* Welcome Section */}
        <div className="rounded-lg p-6 bg-gradient-to-r from-[hsl(260,50%,35%)] to-[hsl(280,50%,45%)] text-white">
          <h2 className="text-2xl font-bold tracking-tight">Welcome back, John!</h2>
          <p className="text-white/80 mt-1">
            Here's an overview of your investment club activity.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title="Total Savings"
            value="KES 175,000"
            change="+12.5% from last month"
            changeType="positive"
            icon={PiggyBank}
          />
          <StatsCard
            title="Active Loans"
            value="KES 25,000"
            change="2 loans outstanding"
            changeType="neutral"
            icon={CreditCard}
          />
          <StatsCard
            title="Interest Earned"
            value="KES 8,750"
            change="+5.2% YTD"
            changeType="positive"
            icon={TrendingUp}
          />
          <StatsCard
            title="Available Balance"
            value="KES 158,750"
            change="After loan deductions"
            changeType="neutral"
            icon={Wallet}
          />
        </div>

        {/* Charts Row */}
        <div className="grid gap-6 lg:grid-cols-2">
          <SavingsChart />
          <LoanRepaymentChart />
        </div>

        {/* Transactions and Actions Row */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <RecentTransactions />
          </div>
          <QuickActions />
        </div>
      </div>
    </AppLayout>
  );
};

export default Dashboard;
