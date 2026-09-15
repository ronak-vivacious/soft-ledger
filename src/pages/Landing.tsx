import { motion } from "framer-motion";
import { useNavigate } from "react-router";
import { useAuth } from "@/hooks/use-auth";
import { ArrowRight, BookOpen, Users, IndianRupee, Shield, Smartphone, Zap } from "lucide-react";
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
      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-teal-light/20 to-cream/40" />
        <div className="relative mx-auto max-w-lg px-6 pt-16 pb-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center"
          >
            {/* Logo/Brand */}
            <div className="inline-flex items-center gap-2 bg-white/80 backdrop-blur-sm px-4 py-2 rounded-full soft-shadow mb-8">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <BookOpen className="h-4.5 w-4.5 text-primary" />
              </div>
              <span className="font-semibold text-sm text-foreground">
                Soft Ledger
              </span>
            </div>

            <h1 className="text-4xl sm:text-5xl font-bold text-foreground leading-tight tracking-tight">
              Bookkeeping,
              <br />
              <span className="text-primary">without the headache</span>
            </h1>

            <p className="text-lg text-muted-foreground mt-6 leading-relaxed max-w-sm mx-auto">
              A friendly way for businesses of all kinds to track orders,
              payments, and customers — all in one place.
            </p>

            <div className="flex flex-col gap-3 mt-8 max-w-xs mx-auto">
              <Button
                onClick={() => navigate("/auth?returnTo=/dashboard")}
                className="h-14 rounded-2xl text-base font-semibold bg-primary hover:bg-primary/90 active:scale-[0.98] transition-all shadow-lg shadow-primary/20"
              >
                Get started — it&apos;s free
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button
                onClick={() => navigate("/auth?returnTo=/dashboard")}
                variant="ghost"
                className="h-12 rounded-2xl text-sm text-muted-foreground"
              >
                I&apos;m here as a customer
              </Button>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Features */}
      <div className="mx-auto max-w-lg px-6 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <h2 className="text-2xl font-bold text-center mb-2">
            Why businesses love Soft Ledger
          </h2>
          <p className="text-muted-foreground text-center mb-10">
            No spreadsheets. No complicated software. Just the good stuff.
          </p>
        </motion.div>

        <div className="space-y-4">
          {[
            {
              icon: Zap,
              title: "One-tap record keeping",
              description:
                "Log an order in a single tap — no clunky forms or confusing menus.",
              color: "bg-primary/10 text-primary",
            },
            {
              icon: IndianRupee,
              title: "Crystal-clear finances",
              description:
                "See who's paid, who owes, and what your day looks like at a glance.",
              color: "bg-success-light text-success",
            },
            {
              icon: Users,
              title: "Keep your customers in the loop",
              description:
                "Your customers see the same records you do — less confusion, more trust.",
              color: "bg-lavender/30 text-lavender",
            },
            {
              icon: Smartphone,
              title: "Works beautifully on any device",
              description:
                "No app to install. Just open it in your browser and you're good to go.",
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
      </div>

      {/* Social Proof */}
      <div className="mx-auto max-w-lg px-6 py-12">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.7 }}
          className="bg-card rounded-3xl p-8 soft-shadow-md text-center border border-border/30"
        >
          <div className="flex justify-center gap-1 mb-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <span key={i} className="text-2xl">
                ⭐
              </span>
            ))}
          </div>
          <p className="text-foreground font-medium italic leading-relaxed">
            &ldquo;I switched from my old notebook and never looked back.
            This is so much easier to keep up with.&rdquo;
          </p>
          <p className="text-sm text-muted-foreground mt-3">
            — A happy small-business owner
          </p>
        </motion.div>
      </div>

      {/* CTA */}
      <div className="mx-auto max-w-lg px-6 py-12 pb-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.8 }}
          className="text-center"
        >
          <h2 className="text-2xl font-bold mb-3">
            Set up in about 30 seconds
          </h2>
          <p className="text-muted-foreground mb-8">
            Totally free. No credit card required.
          </p>
          <Button
            onClick={() => navigate("/auth?returnTo=/dashboard")}
            className="h-14 rounded-2xl text-base font-semibold bg-primary hover:bg-primary/90 active:scale-[0.98] transition-all shadow-lg shadow-primary/20 px-10"
          >
            Open Soft Ledger
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </motion.div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border/50 py-6 text-center">
        <p className="text-xs text-muted-foreground">
          Made with ❤️ for small businesses everywhere
        </p>
      </footer>
    </div>
  );
}
