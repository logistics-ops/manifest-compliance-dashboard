"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { writeAuditLog } from "@/lib/audit";
import { type DocumentReviewCategory, type DocumentReviewStatus } from "@/lib/data/document-review";
import { requireStaffAccess } from "@/lib/integrations/auth";
import { createClient } from "@/lib/supabase/server";
import type { AuthSession } from "@/types/carrier";

const reviewStatuses = new Set<DocumentReviewStatus>(["pending_review", "approved", "rejected", "replacement_requested"]);
const categories = new Set<DocumentReviewCategory>(["carrier", "driver", "vehicle"]);

export async function updateDocumentReviewAction(formData: FormData) {
  const session = await requireStaffAccess();
  const supabase = await createClient();
  const category = String(formData.get("category") ?? "") as DocumentReviewCategory;
  const documentId = String(formData.get("documentId") ?? "");
  const reviewStatus = String(formData.get("reviewStatus") ?? "") as DocumentReviewStatus;
  const reviewNote = optionalString(formData.get("reviewNote"));
  const internalReviewNote = optionalString(formData.get("internalReviewNote"));

  if (!supabase || !categories.has(category) || !documentId || !reviewStatuses.has(reviewStatus)) {
    redirectWithReviewMessage("Unable to update document review.", "error");
  }

  const document = await getReviewTarget(supabase, session, category, documentId);
  if (!document) redirectWithReviewMessage("Document is not available for review.", "error");

  const reviewedAt = new Date().toISOString();
  const replacementRequestedAt = reviewStatus === "replacement_requested" ? reviewedAt : null;
  const { error } = await supabase
    .from(tableForCategory(category))
    .update({
      review_status: reviewStatus,
      review_note: reviewNote,
      internal_review_note: internalReviewNote,
      reviewed_by: session.userId,
      reviewed_at: reviewedAt,
      replacement_requested_at: replacementRequestedAt,
    })
    .eq("id", documentId)
    .eq("organization_id", document.organizationId);

  if (error) redirectWithReviewMessage(error.message, "error");

  const action = reviewStatus === "approved"
    ? "document_review.approved"
    : reviewStatus === "rejected"
      ? "document_review.rejected"
      : reviewStatus === "replacement_requested"
        ? "document_review.replacement_requested"
        : "document_review.note_added";

  await writeAuditLog({
    organizationId: document.organizationId,
    actorUserId: session.userId,
    action,
    entityType: `${category}_document`,
    entityId: documentId,
    metadata: {
      carrier_id: document.carrierId,
      document_name: document.documentName,
      review_status: reviewStatus,
      review_note: reviewNote,
      internal_note_added: Boolean(internalReviewNote),
    },
  });

  if (reviewStatus === "replacement_requested") {
    await upsertCarrierReplacementNotification(supabase, document, reviewNote);
  }

  revalidateReviewViews(document.carrierId);
  redirectWithReviewMessage("Document review updated.", "success");
}

async function getReviewTarget(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  session: AuthSession,
  category: DocumentReviewCategory,
  documentId: string,
) {
  if (category === "carrier") {
    let query = supabase
      .from("carrier_documents")
      .select("id, organization_id, carrier_id, document_name")
      .eq("id", documentId);
    if (session.organizationId && !session.platformSuperAdmin) query = query.eq("organization_id", session.organizationId);
    const { data } = await query.maybeSingle();
    return data ? {
      organizationId: data.organization_id as string,
      carrierId: data.carrier_id as string,
      documentName: data.document_name as string,
    } : null;
  }

  if (category === "driver") {
    let query = supabase
      .from("driver_documents")
      .select("id, organization_id, driver_id, document_name")
      .eq("id", documentId);
    if (session.organizationId && !session.platformSuperAdmin) query = query.eq("organization_id", session.organizationId);
    const { data } = await query.maybeSingle();
    if (!data) return null;
    const { data: driver } = await supabase
      .from("drivers")
      .select("carrier_id")
      .eq("id", data.driver_id)
      .eq("organization_id", data.organization_id)
      .maybeSingle();
    if (!driver) return null;
    return {
      organizationId: data.organization_id as string,
      carrierId: driver.carrier_id as string,
      documentName: data.document_name as string,
    };
  }

  let query = supabase
    .from("equipment_documents")
    .select("id, organization_id, equipment_id, document_name")
    .eq("id", documentId);
  if (session.organizationId && !session.platformSuperAdmin) query = query.eq("organization_id", session.organizationId);
  const { data } = await query.maybeSingle();
  if (!data) return null;
  const { data: equipment } = await supabase
    .from("equipment")
    .select("carrier_id")
    .eq("id", data.equipment_id)
    .eq("organization_id", data.organization_id)
    .maybeSingle();
  if (!equipment) return null;
  return {
    organizationId: data.organization_id as string,
    carrierId: equipment.carrier_id as string,
    documentName: data.document_name as string,
  };
}

async function upsertCarrierReplacementNotification(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  document: { organizationId: string; carrierId: string; documentName: string },
  note: string | null,
) {
  await supabase.from("notifications").upsert({
    organization_id: document.organizationId,
    carrier_id: document.carrierId,
    document_name: document.documentName,
    type: "document_review.replacement_requested",
    title: "Replacement document requested",
    message: note || `${document.documentName} needs to be replaced. Open your upload packet or contact Manifest for a new link.`,
    category: "missing_document",
    priority: "high",
    severity: "high",
    status: "unread",
    related_entity_type: "document_review",
    related_entity_id: document.carrierId,
    related_url: "/documents-to-fix",
    rule_key: `document_review:${document.carrierId}:${slugify(document.documentName)}:replacement_requested`,
    metadata: { document_name: document.documentName },
  }, { onConflict: "organization_id,rule_key" });
}

function tableForCategory(category: DocumentReviewCategory) {
  if (category === "carrier") return "carrier_documents";
  if (category === "driver") return "driver_documents";
  return "equipment_documents";
}

function optionalString(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text || null;
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function revalidateReviewViews(carrierId: string) {
  revalidatePath("/");
  revalidatePath("/document-review");
  revalidatePath("/documents-to-fix");
  revalidatePath("/notifications");
  revalidatePath(`/carriers/${carrierId}`);
}

function redirectWithReviewMessage(message: string, type: "success" | "error"): never {
  redirect(`/document-review?${type}=${encodeURIComponent(message)}`);
}
