import { useState } from "react";
import { useT } from "../../lib/i18n/LocalizationProvider";
import { ActionButton } from "../../shared/ui/ActionButton";
import { Alert } from "../../shared/ui/Alert";
import { PageHeader } from "../../shared/ui/PageHeader";
import { Skeleton } from "../../shared/ui/Skeleton";
import { StatusPill } from "../../shared/ui/StatusPill";
import { useAllRootCauses, useCreateRootCause, useSetRootCauseActive } from "./useRootCauses";

export function VocabularyAdminPage() {
  const { t } = useT();
  const causes = useAllRootCauses();
  const create = useCreateRootCause();
  const setActive = useSetRootCauseActive();

  const [slug, setSlug] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | undefined>();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    if (!slug.trim() || !displayName.trim()) {
      setError(t("vocab.required"));
      return;
    }
    try {
      await create.mutateAsync({
        slug: slug.trim(),
        displayName: displayName.trim(),
        description: description.trim() || undefined
      });
      setSlug("");
      setDisplayName("");
      setDescription("");
    } catch (caught) {
      const err = caught as { message?: string };
      setError(err?.message || t("vocab.createFailed"));
    }
  }

  return (
    <section>
      <PageHeader title={t("vocab.title")} subtitle={t("vocab.subtitle")} />

      <form className="panel" onSubmit={handleSubmit}>
        <div className="panel-title">{t("vocab.formTitle")}</div>
        <div className="form-row">
          <label className="form-field">
            <span>{t("vocab.slug")}</span>
            <input value={slug} onChange={(event) => setSlug(event.target.value)} required />
          </label>
          <label className="form-field">
            <span>{t("vocab.displayName")}</span>
            <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} required />
          </label>
        </div>
        <label className="form-field">
          <span>{t("vocab.description")}</span>
          <input value={description} onChange={(event) => setDescription(event.target.value)} />
        </label>
        {error ? <Alert tone="error">{error}</Alert> : null}
        <ActionButton type="submit" disabled={create.isPending}>
          {create.isPending ? t("common.saving") : t("vocab.submit")}
        </ActionButton>
      </form>

      <div className="panel">
        <div className="panel-title">{t("vocab.listTitle")}</div>
        {causes.isLoading ? (
          <Skeleton className="skeleton-line" />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>{t("vocab.colSlug")}</th>
                <th>{t("vocab.colName")}</th>
                <th>{t("vocab.colDescription")}</th>
                <th>{t("vocab.colStatus")}</th>
                <th>{t("vocab.colActions")}</th>
              </tr>
            </thead>
            <tbody>
              {(causes.data ?? []).map((row) => (
                <tr key={row.itemId}>
                  <td className="mono">{row.Slug ?? "—"}</td>
                  <td>{row.DisplayName ?? "—"}</td>
                  <td>{row.Description ?? "—"}</td>
                  <td><StatusPill tone={row.IsActive === false ? "neutral" : "good"}>{row.IsActive === false ? t("vocab.archived") : t("vocab.active")}</StatusPill></td>
                  <td>
                    <ActionButton
                      onClick={() => row.itemId && setActive.mutate({ itemId: row.itemId, isActive: row.IsActive === false })}
                      disabled={setActive.isPending}
                    >
                      {row.IsActive === false ? t("vocab.restore") : t("vocab.archive")}
                    </ActionButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
