import { useQuery } from "@/lib/api-client";
import { api } from "@/lib/api-client";
import { useAuth } from "@/hooks/use-auth";
import { Routes, Route, Navigate } from "react-router";
import { Loader2 } from "lucide-react";
import VendorHome from "./VendorHome";
import CustomerHome from "./CustomerHome";
import CustomerList from "./CustomerList";
import CustomerDetail from "./CustomerDetail";
import Activity from "./Activity";
import More from "./More";
import InvitePage from "./InvitePage";
import Onboarding from "./Onboarding";
import Products from "./Products";
import Subscriptions from "./Subscriptions";
import Notifications from "./Notifications";
import Profile from "./Profile";
import Connect from "./Connect";

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );
}

export default function Dashboard() {
  const { user, isLoading: authLoading } = useAuth();
  const business = useQuery(api.businesses.getByUser);
  const customer = useQuery(api.customers.getByLinkedUser);

  if (authLoading || business === undefined || customer === undefined) {
    return <LoadingScreen />;
  }

  // If user has no business and no customer record, show onboarding
  if (!business && !customer) {
    return <Onboarding />;
  }

  const isVendor = !!business;

  return (
    <Routes>
      <Route index element={isVendor ? <VendorHome /> : <CustomerHome />} />
      {isVendor && (
        <>
          <Route path="customers" element={<CustomerList />} />
          <Route path="customers/:customerId" element={<CustomerDetail />} />
          <Route path="products" element={<Products />} />
          <Route path="subscriptions" element={<Subscriptions />} />
          <Route path="more/invite" element={<InvitePage />} />
        </>
      )}
      {!isVendor && <Route path="connect" element={<Connect />} />}
      <Route path="activity" element={<Activity />} />
      <Route path="notifications" element={<Notifications />} />
      <Route path="profile" element={<Profile />} />
      <Route path="more" element={<More />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
