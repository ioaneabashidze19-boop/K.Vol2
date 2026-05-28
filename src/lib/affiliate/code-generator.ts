import { supabase } from "../supabaseClient";

/**
 * Generates a unique promo code in the format PREFIX-XXXX and stores it in the special_offers table.
 * If a collision is detected, the function retries until a unique code is inserted.
 * 
 * @param companyId The UUID of the partner company
 * @param prefix The promo code prefix (defaults to 'KAVSH')
 * @param discountType The calculation mode: 'percentage' | 'fixed-amount' | 'free-trial'
 * @param discountValue The numeric value of the discount (e.g. 10.00)
 * @returns The unique generated promo code name
 */
export async function generatePromoCode(
  companyId: string,
  prefix: string = "KAVSH",
  discountType: "percentage" | "fixed-amount" | "free-trial" = "percentage",
  discountValue: number = 10
): Promise<string> {
  if (discountValue < 0) {
    throw new Error("Discount value cannot be negative");
  }

  let uniqueCode = "";
  let success = false;
  let attempts = 0;
  const maxAttempts = 15;

  while (!success && attempts < maxAttempts) {
    attempts++;
    // Generate random 4-character suffix
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let suffix = "";
    for (let i = 0; i < 4; i++) {
      suffix += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    uniqueCode = `${prefix.toUpperCase()}-${suffix}`;

    // Try to check if it exists or insert directly to avoid race conditions.
    // Since there's no unique constraint on name (unless added), we check first.
    const { data: existing } = await supabase
      .from("special_offers")
      .select("id")
      .eq("name", uniqueCode)
      .limit(1);

    if (!existing || existing.length === 0) {
      const { error } = await supabase
        .from("special_offers")
        .insert({
          company_id: companyId,
          name: uniqueCode,
          discount_type: discountType,
          discount_value: discountValue,
          active: true
        });

      if (!error) {
        success = true;
      }
    }
  }

  if (!success) {
    throw new Error("Failed to generate a unique promo code after multiple attempts.");
  }

  return uniqueCode;
}
