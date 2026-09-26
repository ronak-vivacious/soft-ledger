import { useState } from "react";
import { useQuery } from "@/lib/api-client";
import { api } from "@/lib/api-client";
import { AppShell } from "@/components/app/AppShell";
import { Money, formatMoney } from "@/components/app/MoneyDisplay";
import { StatusBadge, getPaymentStatus } from "@/components/app/StatusBadge";
import { SkeletonList } from "@/components/app/SkeletonCard";
import { EmptyState } from "@/components/app/EmptyState";
import { RecordSheet } from "@/components/app/RecordSheet";
import { PaymentSheet } from "@/components/app/PaymentSheet";
import { NewCustomerSheet } from "@/components/app/NewCustomerSheet";
import { useNavigate } from "react-router";
import { Plus, Search } from "lucide-react";

export default function CustomerList() {
  const customers = useQuery(api.customers.getByBusiness);
  const products = useQuery(api.products.getMine);
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [recordingFor, setRecordingFor] = useState<{
    customerId: string;
    customerName: string;
  } | null>(null);
  const [paymentFor, setPaymentFor] = useState<{
    customerId: string;
    customerName: string;
    due: number;
  } | null>(null);

  const filteredCustomers = customers?.filter((c: any) =>
    c.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <AppShell role="vendor">
      <div className="space-y-4 pt-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Customers</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {customers?.length ?? 0} customers
            </p>
          </div>
          <button
            onClick={() => setShowNewCustomer(true)}
            className="h-11 w-11 rounded-full bg-primary text-primary-foreground flex items-center justify-center soft-shadow-md hover:bg-primary/90 active:scale-95 transition-all"
            aria-label="Add customer"
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customers..."
            className="w-full pl-10 pr-4 py-3 bg-card rounded-2xl border border-border/50 text-sm outline-none focus:ring-2 focus:ring-primary/30 transition-all"
          />
        </div>

        {/* Customer List */}
        {!customers ? (
          <SkeletonList count={5} />
        ) : filteredCustomers?.length === 0 && search ? (
          <EmptyState
            icon="🔍"
            title="No customers found"
            description={`No customers match "${search}"`}
          />
        ) : customers.length === 0 ? (
          <EmptyState
            icon="👥"
            title="No customers yet"
            description="Add your first customer to start keeping a digital ledger."
            action={
              <button
                onClick={() => setShowNewCustomer(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 active:scale-95 transition-all"
              >
                <Plus className="h-4 w-4" />
                Add first customer
              </button>
            }
          />
        ) : (
          <div className="space-y-2">
            {filteredCustomers?.map((customer: any) => {
              const status = getPaymentStatus(
                customer.totalBilled,
                customer.totalConfirmed,
              );

              return (
                <div
                  key={customer._id}
                  className="bg-card rounded-2xl p-4 soft-shadow border border-border/20"
                >
                  <div className="flex items-center gap-3">
                    {/* Avatar */}
                    <button
                      onClick={() =>
                        navigate(`/dashboard/customers/${customer._id}`)
                      }
                      className="h-11 w-11 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm shrink-0 hover:bg-primary/15 transition-all"
                    >
                      {customer.name.charAt(0).toUpperCase()}
                    </button>

                    {/* Info */}
                    <button
                      onClick={() =>
                        navigate(`/dashboard/customers/${customer._id}`)
                      }
                      className="flex-1 min-w-0 text-left"
                    >
                      <p className="font-medium text-sm truncate">{customer.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <StatusBadge status={status} />
                        {customer.due > 0 && (
                          <span className="text-xs text-muted-foreground">
                            · {formatMoney(customer.due)} due
                          </span>
                        )}
                        {customer.linkedUserId ? (
                          <span className="text-xs text-success">· linked</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">· offline</span>
                        )}
                      </div>
                    </button>

                    {/* Quick actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      {customer.due > 0 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setPaymentFor({
                              customerId: customer._id,
                              customerName: customer.name,
                              due: customer.due,
                            });
                          }}
                          className="px-3 py-1.5 rounded-full bg-success/10 text-success text-xs font-medium hover:bg-success/15 active:scale-95 transition-all"
                        >
                          ₹ Pay
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setRecordingFor({
                            customerId: customer._id,
                            customerName: customer.name,
                          });
                        }}
                        className="px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium hover:bg-primary/15 active:scale-95 transition-all"
                      >
                        +1
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Sheets */}
      <NewCustomerSheet open={showNewCustomer} onClose={() => setShowNewCustomer(false)} />

      {recordingFor && products && (
        <RecordSheet
          open={!!recordingFor}
          onClose={() => setRecordingFor(null)}
          customerId={recordingFor.customerId}
          customerName={recordingFor.customerName}
          products={products}
        />
      )}

      {paymentFor && (
        <PaymentSheet
          open={!!paymentFor}
          onClose={() => setPaymentFor(null)}
          customerId={paymentFor.customerId}
          customerName={paymentFor.customerName}
          currentDue={paymentFor.due}
          recordedByRole="vendor"
        />
      )}
    </AppShell>
  );
}
