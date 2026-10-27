import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Character } from "@/lib";
import { Button, Dialog, DialogTrigger } from "@/components/ui";
import { SaveEditor } from "@/pages/saves/editor/SaveEditor";

/** The save editor of one character: its attributes and everything it carries, in one window, saved
 * together (one backup, one confirmation). Names, icons and numbers come from the player's game files. */
export function SaveEditorDialog({ profileId, character, disabled }: { profileId: string; character: Character; disabled: boolean }) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  // While saving, the window stays open.
  const [busy, setBusy] = useState(false);
  return <Dialog open={open} onOpenChange={(next, details) => { if (busy) details.cancel(); else setOpen(next); }}>
    <DialogTrigger render={<Button variant="secondary" size="sm" disabled={disabled} />}>{t("saves.editCharacter")}</DialogTrigger>
    {open && <SaveEditor key={`${character.fingerprint}:${i18n.language}`} profileId={profileId} character={character} disabled={disabled}
      onBusy={setBusy} onClose={() => setOpen(false)} />}
  </Dialog>;
}
