/**
 * classificationService.js
 * 
 * Simulates an AI classification engine. Later, this can be swapped out
 * to call OpenAI/Claude or an internal ML model without breaking the controller.
 */

const classifyDocument = (fileName, textPreview) => {
  const name = fileName ? fileName.toLowerCase() : "";
  const text = textPreview ? textPreview.toLowerCase() : "";

  let docType = "Other";
  let subject = "General";
  let department = "Operations";
  let confidence = 0.72;
  let effectiveDate = "";
  let responsibleParty = "";
  let reasoning = "";

  // Document type detection
  if (name.includes("policy") || text.includes("policy") || text.includes("shall comply")) {
    docType = "Policy"; confidence = 0.91;
    reasoning = "Document contains regulatory language and compliance directives consistent with organizational policy documents.";
  } else if (name.includes("sop") || text.includes("standard operating") || text.includes("step 1")) {
    docType = "SOP"; confidence = 0.88;
    reasoning = "Document contains sequential procedural instructions consistent with standard operating procedure format.";
  } else if (name.includes("procedure") || text.includes("procedure") || text.includes("instructions for")) {
    docType = "Procedure"; confidence = 0.85;
    reasoning = "Document describes operational steps and process workflows consistent with procedural documentation.";
  } else if (name.includes("form") || text.includes("please fill") || text.includes("applicant")) {
    docType = "Form"; confidence = 0.93;
    reasoning = "Document contains input fields and data collection elements consistent with organizational forms.";
  } else if (name.includes("handbook") || text.includes("handbook") || text.includes("welcome to")) {
    docType = "Handbook"; confidence = 0.87;
    reasoning = "Document contains comprehensive reference material and onboarding content consistent with handbook format.";
  } else if (name.includes("memo") || text.includes("memorandum") || text.includes("to:") || text.includes("from:")) {
    docType = "Memo"; confidence = 0.82;
    reasoning = "Document contains correspondence headers and directive language consistent with internal memoranda.";
  } else {
    reasoning = "Document does not match established classification patterns with high confidence. Manual review recommended.";
  }

  // Subject detection
  if (text.includes("safety") || text.includes("hazard") || text.includes("osha") || name.includes("safety")) {
    subject = "Safety"; confidence = Math.min(confidence + 0.03, 0.98);
  } else if (text.includes("human resources") || text.includes("employee") || text.includes("hiring") || name.includes("hr")) {
    subject = "HR"; confidence = Math.min(confidence + 0.02, 0.98);
  } else if (text.includes("financial") || text.includes("budget") || text.includes("expense") || name.includes("finance")) {
    subject = "Finance";
  } else if (text.includes("information technology") || text.includes("network") || text.includes("password") || name.includes("it")) {
    subject = "IT";
  } else if (text.includes("legal") || text.includes("compliance") || text.includes("regulation")) {
    subject = "Legal";
  } else if (text.includes("operations") || text.includes("workflow") || text.includes("process")) {
    subject = "Operations";
  }

  // Department detection
  if (subject === "HR") department = "Human Resources";
  else if (subject === "Safety") department = "Health & Safety";
  else if (subject === "Finance") department = "Finance";
  else if (subject === "IT") department = "Information Technology";
  else if (subject === "Legal") department = "Legal & Compliance";

  // Date extraction simulation
  const dateMatch = text.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2},?\s+\d{4}\b/i)
    || text.match(/\b\d{1,2}\/\d{1,2}\/\d{4}\b/)
    || text.match(/\b\d{4}-\d{2}-\d{2}\b/);
  if (dateMatch) effectiveDate = dateMatch[0];
  else effectiveDate = "Not detected";

  // Responsible party simulation
  const partyMatch = text.match(/(?:prepared by|authored by|approved by|responsible[:\s]+)([a-z]+ [a-z]+)/i);
  if (partyMatch) responsibleParty = partyMatch[1];
  else responsibleParty = "Not detected";

  // Return a structured result object matching the requested contract
  return {
    doc_type: docType,
    subject,
    department,
    confidence,
    effective_date: effectiveDate,
    responsible_party: responsibleParty,
    reasoning,
    method: 'simulated'
  };
};

// Standardized naming engine (deterministic, no AI)
const generateStandardName = (classification, originalName) => {
  const typeMap = { Policy: "POL", SOP: "SOP", Procedure: "PRC", Form: "FRM", Handbook: "HBK", Memo: "MEM", Other: "DOC" };
  const deptMap = { "Human Resources": "HR", "Health & Safety": "SAF", Finance: "FIN", "Information Technology": "IT", "Legal & Compliance": "LEG", Operations: "OPS", General: "GEN" };
  const ext = originalName.includes(".") ? originalName.split(".").pop() : "pdf";
  const typeCode = typeMap[classification.doc_type] || "DOC";
  const deptCode = deptMap[classification.department] || "GEN";
  const subjectSlug = classification.subject.replace(/\s+/g, "");
  
  const dateStr = classification.effective_date !== "Not detected"
    ? classification.effective_date.replace(/[\/\s,]+/g, "-").substring(0, 10)
    : new Date().toISOString().split("T")[0];
    
  return `${typeCode}-${deptCode}-${subjectSlug}-${dateStr}-v1.${ext}`;
};

module.exports = {
  classifyDocument,
  generateStandardName
};
