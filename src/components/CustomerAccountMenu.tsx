/** Storefront account button: corporate sign-in link + account menu with logout. */
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut, MapPin, Package, User as UserIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useI18n } from "@/lib/i18n";
import { normalizePhone, useCustomerSession } from "@/lib/customer-auth";
import { supabase } from "@/integrations/supabase/client";


export function CustomerAccountMenu({ compact = false }: { compact?: boolean }) {
  const { lang } = useI18n();
  const bn = lang === "bn";
  const { user, isCustomer, name, phone } = useCustomerSession();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    toast.success(bn ? "লগআউট হয়েছে" : "Signed out");
    navigate({ to: "/", replace: true });
  }

  if (!user || !isCustomer) {
    return (
      <>
        <Button
          variant={compact ? "ghost" : "outline"}
          size={compact ? "sm" : "default"}
          className={compact ? "h-8 px-2 text-xs" : "h-11 rounded-full"}
          onClick={() => setOpen(true)}
        >
          <UserIcon className="mr-1 size-4" />
          {bn ? "লগইন" : "Sign in"}
        </Button>
        <CustomerAuthDialog open={open} onOpenChange={setOpen} />
      </>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="h-11 rounded-full">
          <UserIcon className="mr-1 size-4" />
          <span className="max-w-[90px] truncate">{name || normalizePhone(phone)}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 bg-popover">
        <DropdownMenuLabel className="truncate">{name || (bn ? "আমার অ্যাকাউন্ট" : "My account")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/my-orders">
            <Package className="mr-2 size-4" />
            {bn ? "আমার অর্ডার" : "My orders"}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/my-account" search={{ tab: "addresses" }}>
            <MapPin className="mr-2 size-4" />
            {bn ? "ঠিকানা" : "Addresses"}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={signOut} className="text-destructive focus:text-destructive">
          <LogOut className="mr-2 size-4" />
          {bn ? "লগআউট" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
