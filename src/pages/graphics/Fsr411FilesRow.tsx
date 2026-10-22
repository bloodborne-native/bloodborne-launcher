import { useTranslation } from "react-i18next";
import { open } from "@tauri-apps/plugin-dialog";
import { FileSearch } from "lucide-react";
import { SettingRow } from "@/components/settings";
import { Button } from "@/components/ui";
import { useAddFsr411Files } from "@/hooks";

type Props = { ready: boolean };

/** AMD's two FSR 4.1.1 files: found, or taken from the player's own AMD upscaler DLL. */
export function Fsr411FilesRow({ ready }: Props) {
  const { t } = useTranslation();
  const add = useAddFsr411Files();
  const choose = async () => {
    const picked = await open({
      multiple: false,
      directory: false,
      filters: [{ name: "DLL", extensions: ["dll"] }],
      title: t("graphics.fsr411ChooseDll"),
    });
    if (typeof picked === "string") add.mutate(picked);
  };
  return (
    <SettingRow title={t("graphics.fsr411Files")} description={t(ready ? "graphics.fsr411FilesReady" : "graphics.fsr411FilesMissing")}>
      {!ready && (
        <Button variant="secondary" size="sm" onClick={choose} disabled={add.isPending}>
          <FileSearch /> {t("graphics.fsr411ChooseDll")}
        </Button>
      )}
    </SettingRow>
  );
}
