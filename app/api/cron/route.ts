import { NextResponse } from "next/server";
import { db } from "@/db";
import { cacheFileTable } from "@/db/schema";
import { lt, sql } from "drizzle-orm";

export async function GET(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    console.log("Cron job started: Cleaning up cache.");

    // Delete expired cache_file entries (default 7 days)
    const fileCacheTTL = parseInt(process.env.FILE_CACHE_TTL || "10080") * 60 * 1000;
    const fileExpiryDate = new Date(Date.now() - fileCacheTTL);
    const deletedFiles = await db.delete(cacheFileTable)
      .where(lt(cacheFileTable.lastUpdated, fileExpiryDate)).returning();
    console.log(`Deleted ${deletedFiles.length} expired file cache entries.`);

    console.log("Running VACUUM on cache_file.");
    await db.execute(sql`VACUUM cache_file`);
    console.log("VACUUM executed.");

    return NextResponse.json({ success: true, deletedFiles: deletedFiles.length });
  } catch (error) {
    console.error("Error cleaning up cache:", error);
    return NextResponse.json({ error: "Failed to clean up cache" }, { status: 500 });
  }
}
