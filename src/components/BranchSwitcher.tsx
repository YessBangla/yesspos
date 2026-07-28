import { Building2, Check, ChevronsUpDown } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useI18n } from "@/lib/i18n";
import { useActiveBranch } from "@/lib/active-branch";
import { cn } from "@/lib/utils";

/** Header control that shows — and for admins, switches — the working branch. */
export function BranchSwitcher() {
  const { t } = useI18n();
  const { branch, options, canSwitch, setBranch } = useActiveBranch();
  const [open, setOpen] = useState(false);

  const label = branch?.name ?? t("noBranch");

  if (!canSwitch || options.length < 2) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2 py-1 text-xs font-medium text-muted-foreground">
        <Building2 className="size-3.5" />
        <span className="max-w-[9rem] truncate">{label}</span>
      </span>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 px-2 text-xs">
          <Building2 className="size-3.5 text-primary" />
          <span className="max-w-[9rem] truncate">{label}</span>
          <ChevronsUpDown className="size-3.5 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-1">
        <p className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {t("switchBranch")}
        </p>
        {options.map((b) => (
          <button
            key={b.id}
            type="button"
            onClick={() => {
              setBranch(b.id);
              setOpen(false);
            }}
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent",
              b.id === branch?.id && "bg-accent/60 font-medium",
            )}
          >
            <Building2 className="size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate">{b.name}</span>
            <span className="text-[10px] uppercase text-muted-foreground">{b.code}</span>
            {b.id === branch?.id && <Check className="size-3.5 text-primary" />}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
