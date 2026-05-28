import { supabase } from "@/lib/supabaseClient";

export interface ContractData {
  status?: "draft" | "pending_signatures" | "active" | "completed" | "cancelled";
  start_date: string;
  end_date?: string | null;
  monthly_value: number;
  commission_rate: number;
  special_offer_id?: string | null;
}

/**
 * Creates a new contract record after validating that the associated engagement exists.
 */
export async function createContract(engagementId: string, contractData: ContractData) {
  // 1. Verify engagement exists
  const { data: engagement, error: engError } = await supabase
    .from("engagements")
    .select("id, status")
    .eq("id", engagementId)
    .single();

  if (engError || !engagement) {
    throw new Error(`Invalid engagement ID: ${engError?.message || "Not found"}`);
  }

  // 2. Insert contract
  const { data: contract, error: contractErr } = await supabase
    .from("contracts")
    .insert({
      engagement_id: engagementId,
      special_offer_id: contractData.special_offer_id || null,
      status: contractData.status || "draft",
      start_date: contractData.start_date,
      end_date: contractData.end_date || null,
      monthly_value: contractData.monthly_value,
      commission_rate: contractData.commission_rate,
    })
    .select()
    .single();

  if (contractErr) {
    throw contractErr;
  }

  return contract;
}

/**
 * Fetches full contract details including engagement, seeker/provider profiles, and commission schedules.
 */
export async function getContractById(contractId: string) {
  const { data: contract, error } = await supabase
    .from("contracts")
    .select(`
      *,
      special_offers (*),
      engagement:engagements (
        *,
        seeker:seekers (*),
        company:companies (*)
      ),
      commission_schedules:commission_schedules (*)
    `)
    .eq("id", contractId)
    .single();

  if (error) {
    throw error;
  }

  return contract;
}

/**
 * Fetches all contracts for a specific provider.
 */
export async function getProviderContracts(providerId: string) {
  const { data: contracts, error } = await supabase
    .from("contracts")
    .select(`
      *,
      engagement:engagements!inner (
        *,
        seeker:seekers (*)
      )
    `)
    .eq("engagement.company_id", providerId);

  if (error) {
    throw error;
  }

  return contracts;
}

/**
 * Fetches all contracts for a specific seeker.
 */
export async function getSeekerContracts(seekerId: string) {
  const { data: contracts, error } = await supabase
    .from("contracts")
    .select(`
      *,
      engagement:engagements!inner (
        *,
        company:companies (*)
      )
    `)
    .eq("engagement.seeker_id", seekerId);

  if (error) {
    throw error;
  }

  return contracts;
}

/**
 * Updates contract status and runs specific triggers (e.g. schedule generation or cancellation penalties).
 */
export async function updateContractStatus(contractId: string, status: "draft" | "pending_signatures" | "active" | "completed" | "cancelled") {
  const { error: updateErr } = await supabase
    .from("contracts")
    .update({ status })
    .eq("id", contractId);

  if (updateErr) {
    throw updateErr;
  }

  if (status === "active") {
    // Trigger dynamic commission schedule creation
    const { error: rpcErr } = await supabase.rpc("generate_commission_schedules", {
      p_contract_id: contractId,
    });
    if (rpcErr) throw rpcErr;
  } else if (status === "cancelled") {
    // Trigger contract termination minimum penalties
    const { error: rpcErr } = await supabase.rpc("enforce_cancellation_minimums", {
      p_contract_id: contractId,
    });
    if (rpcErr) throw rpcErr;
  }
}

/**
 * Cancels a contract, records reasons, and enforces minimum fee penalties.
 */
export async function cancelContract(contractId: string, reason: string) {
  const { error: updateErr } = await supabase
    .from("contracts")
    .update({
      status: "cancelled",
      cancellation_reason: reason,
    })
    .eq("id", contractId);

  if (updateErr) {
    throw updateErr;
  }

  // Call database constraint rule function
  const { error: rpcErr } = await supabase.rpc("enforce_cancellation_minimums", {
    p_contract_id: contractId,
  });

  if (rpcErr) {
    throw rpcErr;
  }
}

/**
 * Records a signature from either seeker user or provider owner, and activates when both are signed.
 */
export async function signContract(contractId: string, userId: string) {
  // 1. Load contract and identity keys
  const { data: contract, error: getErr } = await supabase
    .from("contracts")
    .select(`
      *,
      engagement:engagements (
        *,
        seeker:seekers (user_id),
        company:companies (owner_id)
      )
    `)
    .eq("id", contractId)
    .single();

  if (getErr || !contract) {
    throw new Error(`Contract not found: ${getErr?.message || ""}`);
  }

  const isSeeker = contract.engagement?.seeker?.user_id === userId;
  const isProvider = contract.engagement?.company?.owner_id === userId;

  if (!isSeeker && !isProvider) {
    throw new Error("User is not authorized to sign this contract document");
  }

  const now = new Date().toISOString();
  const updates: any = {};

  if (isSeeker) {
    updates.signed_by_seeker = now;
  }
  if (isProvider) {
    updates.signed_by_provider = now;
  }

  // Check if this signature makes it fully signed by both parties
  const fullySigned = 
    (isSeeker || contract.signed_by_seeker) && 
    (isProvider || contract.signed_by_provider);

  if (fullySigned) {
    updates.status = "active";
  } else {
    updates.status = "pending_signatures";
  }

  const { error: updateErr } = await supabase
    .from("contracts")
    .update(updates)
    .eq("id", contractId);

  if (updateErr) {
    throw updateErr;
  }

  // Trigger schedules if activated
  if (fullySigned) {
    const { error: rpcErr } = await supabase.rpc("generate_commission_schedules", {
      p_contract_id: contractId,
    });
    if (rpcErr) throw rpcErr;
  }
}
