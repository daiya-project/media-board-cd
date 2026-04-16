/**
 * Data Board root — redirects to /data-board/daily.
 *
 * The DATA section is split into daily/weekly/monthly sub-pages.
 * This redirect ensures bookmarks and sidebar links to /data-board
 * still land on the default (daily) view.
 */

import { redirect } from "next/navigation";

export default function DataBoardPage() {
  redirect("/data-board/daily");
}
