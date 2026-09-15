import { Bell, CheckCheck, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { blocksClient } from "../../lib/blocks/client";
import { useCurrentUser } from "../../features/profile/useCurrentUser";
import { normalizeInbox } from "../../features/notifications/inbox";
import { useT, tx } from "../../lib/i18n/LocalizationProvider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "../../shared/ui/dropdown-menu";

export function NotificationsMenu() {
  const { t, language } = useT(), me = useCurrentUser(), queryClient = useQueryClient();
  const [page, setPage] = useState(1), [unreadOnly, setUnreadOnly] = useState(false);
  const inbox = useQuery({ queryKey: ["notifications", me.data?.data?.itemId, page, unreadOnly], enabled: Boolean(me.data?.data?.itemId),
    queryFn: async () => normalizeInbox(await blocksClient.notifier.getNotifications({ page, pageSize: 20, isUnreadOnly: unreadOnly, sortBy: "CreatedTime", sortDescending: true })), refetchInterval: 30000, retry: false });
  const mark = useMutation({ mutationFn: async (id?: string) => {
    const result = id ? await blocksClient.notifier.markNotificationAsRead({ id }) : await blocksClient.notifier.markAllNotificationAsRead();
    if (result?.isSuccess === false) throw new Error("Could not mark notification read");
  }, onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }) });
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="icon-button notification-trigger" aria-label={t("notifications.title")} title={t("notifications.title")}>
        <Bell size={18} />{inbox.data?.unread ? <span className="notification-count">{inbox.data.unread > 99 ? "99+" : inbox.data.unread}</span> : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="notification-menu">
        <DropdownMenuLabel>{t("notifications.title")}</DropdownMenuLabel>
        <div className="notification-tools"><label><input type="checkbox" checked={unreadOnly} onChange={event => { setUnreadOnly(event.target.checked); setPage(1); }} /> {t("notifications.unread")}</label><button className="icon-button" title={t("common.refresh")} aria-label={t("common.refresh")} onClick={() => void inbox.refetch()}><RefreshCw size={16} /></button><button className="icon-button" title={t("notifications.readAll")} aria-label={t("notifications.readAll")} onClick={() => mark.mutate(undefined)} disabled={!inbox.data?.unread || mark.isPending}><CheckCheck size={18} /></button></div>
        <DropdownMenuSeparator />
        {inbox.isError || mark.isError ? <p className="notification-status" role="alert">{t("notifications.failed")}</p> : null}
        {inbox.isPending ? <p className="notification-status">{t("common.loading")}</p> : !inbox.isError && !inbox.data?.items.length ? <p className="notification-status">{t("notifications.empty")}</p> : null}
        <div className="notification-list">{inbox.data?.items.map(item => <DropdownMenuItem key={item.id} disabled={mark.isPending || item.read} className={`notification-item ${item.read ? "is-read" : ""}`} onSelect={event => { event.preventDefault(); mark.mutate(item.id); }}><Bell size={16} /><div><strong>{t(tx(`notifications.${item.kind}`))}</strong>{item.reference ? <span className="mono">{item.reference}</span> : null}{Number.isFinite(Date.parse(item.created)) ? <time>{new Date(item.created).toLocaleString(language)}</time> : null}</div>{!item.read ? <span className="notification-dot" /> : null}</DropdownMenuItem>)}</div>
        <div className="notification-pagination"><button className="icon-button" aria-label={t("notifications.previous")} title={t("notifications.previous")} disabled={page === 1} onClick={() => setPage(value => value - 1)}><ChevronLeft size={18} /></button><span>{page}</span><button className="icon-button" aria-label={t("notifications.next")} title={t("notifications.next")} disabled={page * 20 >= (inbox.data?.total ?? 0)} onClick={() => setPage(value => value + 1)}><ChevronRight size={18} /></button></div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
