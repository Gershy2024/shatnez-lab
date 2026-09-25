import { NextRequest, NextResponse } from "next/server";
import { getAllCalls, getAllOrders, CallRecord } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(5, parseInt(url.searchParams.get("limit") || "25", 10)));
    const search = (url.searchParams.get("search") || "").trim().toLowerCase();
    const direction = (url.searchParams.get("direction") || "all").toLowerCase();
    const status = (url.searchParams.get("status") || "all").toLowerCase();

    // Fetch all calls
    const allCalls = await getAllCalls();

    // If search text provided, build customer name lookup to match by customer name
    let phoneToNameMap: Map<string, string> | null = null;
    if (search) {
      try {
        const orders = await getAllOrders();
        phoneToNameMap = new Map();
        for (const o of orders) {
          if (o.customerName) {
            if (o.phone) {
              const c1 = o.phone.replace(/\D/g, "");
              if (c1) phoneToNameMap.set(c1, o.customerName.toLowerCase());
            }
            if (o.phone2) {
              const c2 = o.phone2.replace(/\D/g, "");
              if (c2) phoneToNameMap.set(c2, o.customerName.toLowerCase());
            }
          }
        }
      } catch (err) {
        console.warn("[API /api/calls] Failed to load orders for search:", err);
      }
    }

    // Filter calls
    const filtered = allCalls.filter((call) => {
      // Direction filter
      const isOutbound =
        call.direction === "outbound" ||
        (call.actions && call.actions.some((act) => act.toLowerCase().includes("outbound")));
      if (direction === "inbound" && isOutbound) return false;
      if (direction === "outbound" && !isOutbound) return false;

      // Status filter
      if (status !== "all" && call.status !== status) return false;

      // Search filter
      if (search) {
        const rawPhone = (call.phone || "").toLowerCase();
        const cleanPhone = (call.phone || "").replace(/\D/g, "");
        const searchDigits = search.replace(/\D/g, "");

        const matchesPhone =
          rawPhone.includes(search) ||
          (searchDigits.length >= 3 && cleanPhone.includes(searchDigits));

        let matchesCustomer = false;
        if (phoneToNameMap && cleanPhone) {
          const custName = phoneToNameMap.get(cleanPhone);
          if (custName && custName.includes(search)) {
            matchesCustomer = true;
          }
        }

        const matchesOrderId = call.orderId ? call.orderId.toLowerCase().includes(search) : false;
        const matchesAction = call.actions
          ? call.actions.some((a) => a.toLowerCase().includes(search))
          : false;

        if (!matchesPhone && !matchesCustomer && !matchesOrderId && !matchesAction) {
          return false;
        }
      }

      return true;
    });

    // Ensure sorted by timestamp descending
    filtered.sort((a, b) => b.timestamp - a.timestamp);

    const totalCount = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / limit));
    const safePage = Math.min(page, totalPages);
    const offset = (safePage - 1) * limit;
    const paginatedCalls = filtered.slice(offset, offset + limit);

    return NextResponse.json({
      success: true,
      calls: paginatedCalls,
      pagination: {
        page: safePage,
        limit,
        totalCount,
        totalPages,
        hasNext: safePage < totalPages,
        hasPrev: safePage > 1,
      },
    });
  } catch (error: any) {
    console.error("[API /api/calls] Error in paginated calls endpoint:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch paginated calls" },
      { status: 500 }
    );
  }
}
