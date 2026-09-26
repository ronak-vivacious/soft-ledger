import { motion } from "framer-motion";
import { useNavigate } from "react-router";
import { useAuth } from "@/hooks/use-auth";
import {
  ArrowRight,
  BookOpen,
  Repeat,
  IndianRupee,
  ShieldCheck,
  Smartphone,
  Zap,
  Milk,
  Coffee,
  ShoppingBasket,
  Truck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useEffect } from "react";

export default function Landing() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (isAuthenticated) {
      navigate("/dashboard", { replace: true });
    }
  }, [isAuthenticated, navigate]);

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="relative z-10 max-w-lg mx-auto flex items-center justify-between px-6 pt-6">
        <a href="/" className="flex items-center gap-2" aria-label="Soft Ledger home">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <BookOpen className="h-4 w-4 text-primary" />
          </div>
          <span className="font-semibold text-sm">Soft Ledger</span>
        </a>
        <button
          onClick={() => navigate("/auth?returnTo=/dashboard")}
          className="text-sm font-medium text-primary hover:underline"
        >
          Sign in
        </button>
      </nav>

      {/* Hero */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-teal-light/20 to-cream/40" />
        <div className="relative mx-auto max-w-lg px-6 pt-14 pb-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center"
          >
            <h1 className="text-4xl sm:text-5xl font-bold text-foreground leading-tight tracking-tight text-balance">
              No more physical cards.
              <br />
              <span className="text-primary">No more manual calculations.</span>
            </h1>

            <p className="text-lg text-muted-foreground mt-6 leading-relaxed max-w-md mx-auto">
              Soft Ledger is the digital purchase book for milk distributors,
              tea shops, grocery stores and subscription vendors. Track every
              purchase, automate recurring deliveries, and know exactly who owes
              what — without disputes.
            </p>

            <div className="flex flex-col gap-3 mt-8 max-w-xs mx-auto">
              <Button
                onClick={() => navigate("/auth?returnTo=/dashboard")}
                className="h-14 rounded-2xl text-base font-semibold bg-primary hover:bg-primary/90 active:scale-[0.98] transition-all shadow-lg shadow-primary/20"
              >
                Get started — it's free
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Vendor or customer — you choose on the next screen
              </p>
            </div>
          </motion.div>
        </div>
      </header>

      {/* Use cases */}
      <section className="mx-auto max-w-lg px-6 py-10" aria-labelledby="who-heading">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
        >
          <h2 id="who-heading" className="text-2xl font-bold text-center tracking-tight">
            Built for recurring-purchase businesses
          </h2>
          <p className="text-muted-foreground text-center mb-8 mt-2">
            If your customers buy from you every day or week, this replaces your card register.
          </p>
        </motion.div>

        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: Milk, label: "Milk distributors" },
            { icon: Coffee, label: "Tea shops" },
            { icon: ShoppingBasket, label: "Grocery stores" },
            { icon: Truck, label: "Local distributors" },
          ].map((u, i) => (
            <motion.div
              key={u.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.25 + i * 0.07 }}
            >
              <Card className="border-border/30 soft-shadow h-full">
                <CardContent className="p-4 flex flex-col items-center gap-2 text-center">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <u.icon className="h-5 w-5 text-primary" />
                  </div>
                  <p className="text-sm font-medium">{u.label}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-lg px-6 py-12" aria-labelledby="features-heading">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <h2 id="features-heading" className="text-2xl font-bold text-center tracking-tight">
            Everything the paper card did — and everything it couldn't
          </h2>
          <p className="text-muted-foreground text-center mb-10 mt-2">
            No spreadsheets. No forgotten payments. Just clear records both sides trust.
          </p>
        </motion.div>

        <div className="space-y-4">
          {[
            {
              icon: Zap,
              title: "One-tap purchase log",
              description:
                "Log a delivery in a single tap — quantity and amount calculate themselves, and prices are preserved in history.",
              color: "bg-primary/10 text-primary",
            },
            {
              icon: Repeat,
              title: "Subscriptions on autopilot",
              description:
                "1 litre milk daily? Tea every morning? Set it once and purchases are logged on schedule, automatically.",
              color: "bg-teal-light text-teal",
            },
            {
              icon: IndianRupee,
              title: "Balances both sides agree on",
              description:
                "Payments are recorded, then verified by the other person. Both vendor and customer always see the same numbers.",
              color: "bg-success-light text-success",
            },
            {
              icon: ShieldCheck,
              title: "History you can trust",
              title2: true,
              description:
                "Confirmed payments can't be silently edited — corrections create audited reversal records. Monthly statements are generated for every customer.",
              color: "bg-lavender/30 text-lavender",
            },
            {
              icon: Smartphone,
              title: "Works on any phone",
              description:
                "No app to install. Open it in the browser and you're good to go — built mobile-first.",
              color: "bg-peach/30 text-peach",
            },
          ].map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.3 + i * 0.1 }}
            >
              <Card className="border-border/30 soft-shadow">
                <CardContent className="p-5 flex items-start gap-4">
                  <div
                    className={`h-11 w-11 rounded-xl ${feature.color} flex items-center justify-center shrink-0`}
                  >
                    <feature.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-lg px-6 py-12" aria-labelledby="how-heading">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <h2 id="how-heading" className="text-2xl font-bold text-center tracking-tight mb-8">
            Start tracking in three steps
          </h2>
        </motion.div>
        <ol className="space-y-4">
          {[
            {
              n: "1",
              title: "Create your account",
              desc: "Choose vendor or customer, pick a unique username, and verify your email.",
            },
            {
              n: "2",
              title: "Connect with each other",
              desc: "Vendors invite customers with a QR code or link — or find each other by username.",
            },
            {
              n: "3",
              title: "Log, automate, settle",
              desc: "Record purchases, set up subscriptions, record payments and verify them together.",
            },
          ].map((s, i) => (
            <motion.li
              key={s.n}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.45 + i * 0.1 }}
              className="flex gap-4"
            >
              <span className="h-9 w-9 rounded-full bg-primary text-white font-bold flex items-center justify-center shrink-0">
                {s.n}
              </span>
              <div>
                <h3 className="font-semibold">{s.title}</h3>
                <p className="text-sm text-muted-foreground mt-0.5">{s.desc}</p>
              </div>
            </motion.li>
          ))}
        </ol>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-lg px-6 py-12 pb-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="bg-card rounded-3xl p-8 soft-shadow-md text-center border border-border/30"
        >
          <h2 className="text-2xl font-bold mb-3 tracking-tight">
            Replace your card register today
          </h2>
          <p className="text-muted-foreground mb-8">
            Free to use. No credit card required. Set up in about 30 seconds.
          </p>
          <Button
            onClick={() => navigate("/auth?returnTo=/dashboard")}
            className="h-14 rounded-2xl text-base font-semibold bg-primary hover:bg-primary/90 active:scale-[0.98] transition-all shadow-lg shadow-primary/20 px-10"
          >
            Create your account
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-6 text-center">
        <p className="text-xs text-muted-foreground">
          Made with ❤️ for small businesses everywhere
        </p>
      </footer>
    </div>
  );
}
