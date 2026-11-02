import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { BookOpen, Bug, Code2, Map } from "lucide-react";
import { DiscordIcon } from "@/components/brand";
import { PageHeader, SettingsSection } from "@/components/settings";
import { Button } from "@/components/ui";
import { useConfig } from "@/hooks";
import { api } from "@/lib";

type LinkId = Parameters<typeof api.openLink>[0];

/** What the project is, where to find it and who it is built on. */
export function AboutPage() {
  const { t } = useTranslation();
  const { data: config } = useConfig();
  const links: { id: LinkId; icon: ReactNode; label: string }[] = [
    { id: "discord", icon: <DiscordIcon />, label: "Discord" },
    { id: "source", icon: <Code2 />, label: t("about.sourceCode") },
    { id: "issues", icon: <Bug />, label: t("about.report") },
    { id: "guides", icon: <BookOpen />, label: t("about.guides") },
    { id: "roadmap", icon: <Map />, label: t("about.roadmap") },
  ];
  return <>
    <PageHeader title={t("nav.about")} subtitle={t("about.subtitle")} />
    <SettingsSection title={t("app.name")}>
      <div className="grid gap-2 px-4 pb-4 pt-1 text-sm text-muted-foreground sm:px-5">
        <p>{t("about.what1")}</p>
        <p>{t("about.what2")}</p>
      </div>
    </SettingsSection>
    <SettingsSection title={t("about.linksTitle")}>
      <div className="flex flex-wrap gap-2 px-4 pb-4 pt-1 sm:px-5">
        {links.map((link) => (
          <Button key={link.id} variant="secondary" size="sm" onClick={() => void api.openLink(link.id)}>
            {link.icon} {link.label}
          </Button>
        ))}
      </div>
    </SettingsSection>
    <SettingsSection title={t("about.creditsTitle")}>
      <div className="grid gap-2 px-4 pb-4 pt-1 text-sm text-muted-foreground sm:px-5">
        <p>{t("about.credits")}</p>
        <p>{t("about.legal")}</p>
        <p>{t("app.version", { version: config?.version ?? "" })}</p>
      </div>
    </SettingsSection>
  </>;
}
