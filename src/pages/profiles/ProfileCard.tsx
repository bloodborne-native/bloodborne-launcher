import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { TrophyStatus, TrophySummary } from "@/components/trophies";
import { Badge, Button, Input, Label } from "@/components/ui";
import { DeleteProfileDialog } from "@/pages/profiles/DeleteProfileDialog";
import type { ProfileChange, SaveProfile } from "@/lib";

export function ProfileCard({ profile, active, disabled, busy, onChange, onOpen }: {
  onOpen: () => void;
  profile: SaveProfile; active: boolean; disabled: boolean; busy: boolean; onChange: (change: ProfileChange) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(profile.name);
  return (<div className="px-4 py-4 sm:px-5">
    <div className="flex flex-wrap items-center gap-3">
      <h2 className="min-w-0 basis-full sm:basis-auto sm:flex-1">
        <Button variant="ghost" className="h-auto max-w-full justify-start whitespace-normal px-0 text-base hover:bg-transparent hover:text-parchment" onClick={onOpen}>
          <span className="break-words text-left">{profile.name}</span><ChevronRight aria-hidden="true" />
        </Button>
      </h2>
      <TrophySummary profile={profile} />
      {active ? <Badge>{t("saves.active")}</Badge> : <Button size="sm" disabled={disabled} onClick={() => onChange({ action: "select", id: profile.id }).catch(() => {})}>{t("profiles.use")}</Button>}
      <Button size="sm" variant="secondary" disabled={disabled} onClick={() => { setName(profile.name); setEditing(true); }}>{t("profiles.rename")}</Button>
      <DeleteProfileDialog profile={profile} active={active} disabled={disabled} busy={busy}
        onDelete={() => onChange({ action: "delete", id: profile.id })} />
    </div>
    <TrophyStatus profile={profile} />
    {editing && <form className="mt-3 flex items-center gap-3" onSubmit={async (event) => {
      event.preventDefault();
      try { await onChange({ action: "rename", id: profile.id, name: name.trim() }); setEditing(false); } catch { /* Reported by hook. */ }
    }}>
      <Label className="sr-only" htmlFor={`rename-${profile.id}`}>{t("saves.name")}</Label>
      <Input id={`rename-${profile.id}`} maxLength={80} required value={name} disabled={disabled} onChange={(e) => setName(e.target.value)} />
      <Button type="submit" size="sm" disabled={disabled || !name.trim()}>{t("profiles.rename")}</Button>
      <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>{t("saves.cancel")}</Button>
    </form>}
  </div>);
}
