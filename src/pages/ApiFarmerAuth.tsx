import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { farmerLoginByCode } from "@/lib/api/auth";
import { ShieldCheck } from "lucide-react";

export default function ApiFarmerAuth() {
  const [code, setCode] = useState("");
  const [mobile, setMobile] = useState("");
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await farmerLoginByCode(code.trim(), mobile.trim());
      toast({ title: "Welcome", description: "Signed in successfully" });
      navigate("/api/farmer-portal");
    } catch (err: any) {
      toast({
        title: "Login failed",
        description: err?.response?.data?.message || err.message,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Farmer sign in</CardTitle>
          <CardDescription>Enter your Farmer ID and registered mobile number</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code">Farmer ID</Label>
              <Input
                id="code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. FRM-0001"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mobile">Mobile number</Label>
              <Input
                id="mobile"
                type="tel"
                inputMode="numeric"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                placeholder="01XXXXXXXXX"
                autoComplete="tel"
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="justify-center border-t pt-4">
          <Link
            to="/api/auth"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ShieldCheck className="h-4 w-4" />
            Staff / Admin sign in
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
