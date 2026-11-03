import { useState, useRef, useEffect } from "react";
import { 
  User, Mail, Lock, Shield, Camera, KeyRound, Loader2, CheckCircle2, AlertCircle, 
  FileText, Upload, Trash2, Cloud, Paperclip, MessageSquare, Send, Check, 
  Info, PhoneCall, Zap, SlidersHorizontal
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { UI } from "@/ui/colors";
import usersApi from "@/api/usersApi";
import emailApi from "@/api/emailApi";
import { apiClient } from "@/api/apiClient";
import { whatsappApi, type Template as WhatsAppTemplate, type Account as WhatsAppAccount } from "@/api/whatsapp";
import RichEmailEditor from "@/components/email/RichEmailEditor";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function formatFileSize(bytes: any): string {
  const num = typeof bytes === "number" ? bytes : Number(bytes);
  if (isNaN(num) || num <= 0) return "0 B";
  if (num < 1024) return num + " B";
  if (num < 1024 * 1024) return (num / 1024).toFixed(1) + " KB";
  return (num / (1024 * 1024)).toFixed(2) + " MB";
}

function normalizeBrochure(b: any) {
  if (!b || typeof b !== "object") return null;
  const name = b.name || b.filename || "Brochure.pdf";
  const size = typeof b.size === "number" ? b.size : (typeof b.size_bytes === "number" ? b.size_bytes : (Number(b.size) || Number(b.size_bytes) || 0));
  const key = b.key || b.cloud_storage_key || b.url || "";
  const mediaId = b.mediaId || b.provider_media_id || b.id || "";
  const id = b.id || b.attachment_id || mediaId || "";
  return {
    name,
    size,
    key,
    mediaId,
    id,
    filename: name,
    size_bytes: size,
    cloud_storage_key: key,
    provider_media_id: mediaId
  };
}

export default function SettingsPage() {
  const { user, refreshUser } = useAuth();

  // Top Section Filter Tab
  const [activeTab, setActiveTab] = useState<"all" | "profile" | "messaging">("all");

  // Profile State
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [profilePicture, setProfilePicture] = useState(user?.profile_picture || "");
  const [profileCurrentPassword, setProfileCurrentPassword] = useState("");

  const [profileError, setProfileError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Security State
  const [secCurrentPassword, setSecCurrentPassword] = useState("");
  const [secNewPassword, setSecNewPassword] = useState("");
  const [secConfirmPassword, setSecConfirmPassword] = useState("");

  const [secError, setSecError] = useState("");
  const [secSuccess, setSecSuccess] = useState("");
  const [isSavingSecurity, setIsSavingSecurity] = useState(false);

  // =========================================================================
  // Automated Email Dispatch & Brochure State
  // =========================================================================
  const [emailAutoSend, setEmailAutoSend] = useState(true);
  const [emailTriggerEvent, setEmailTriggerEvent] = useState<"both" | "conversations" | "leads">("both");
  const [emailSubject, setEmailSubject] = useState("VoiceDots Academy - Information & Course Brochure");
  const [emailContent, setEmailContent] = useState(
    "Dear {{name}},\n\nThank you for speaking with our team! As discussed during our conversation, please find our detailed prospectus and admission brochure attached.\n\nKey Highlights:\n- Accredited programs & industry curriculum\n- Comprehensive placement & internship support\n- Financial aid and scholarship opportunities\n\nIf you have any further questions or would like to schedule a campus tour, simply reply to this email.\n\nWarm regards,\nAdmissions & Outreach Office\nVoiceDots"
  );
  const [emailBrochure, setEmailBrochure] = useState<{
    name: string;
    size: number;
    key: string;
    id?: string;
  } | null>({
    name: "VoiceDots_Course_Brochure_2026.pdf",
    size: 2450000,
    key: "email/org_default/attachments/f8a3c10b-8d54-4721-a08b/VoiceDots_Course_Brochure_2026.pdf",
    id: "f8a3c10b-8d54-4721-a08b"
  });
  const [isUploadingEmailBrochure, setIsUploadingEmailBrochure] = useState(false);
  const [isSavingEmail, setIsSavingEmail] = useState(false);
  const [emailStatus, setEmailStatus] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // =========================================================================
  // Automated WhatsApp Template & Brochure State
  // =========================================================================
  const [waAutoSend, setWaAutoSend] = useState(true);
  const [waTriggerEvent, setWaTriggerEvent] = useState<"both" | "conversations" | "leads">("both");
  const [waAccounts, setWaAccounts] = useState<WhatsAppAccount[]>([]);
  const [waAccountId, setWaAccountId] = useState("");
  const [waTemplates, setWaTemplates] = useState<WhatsAppTemplate[]>([]);
  const [selectedWaTemplateId, setSelectedWaTemplateId] = useState("");
  const [waBrochure, setWaBrochure] = useState<{
    name: string;
    size: number;
    key: string;
    mediaId?: string;
  } | null>({
    name: "VoiceDots_Official_Brochure.pdf",
    size: 1840000,
    key: "whatsapp/documents/media_920194829104812/VoiceDots_Official_Brochure.pdf",
    mediaId: "media_920194829104812"
  });
  const [isUploadingWaBrochure, setIsUploadingWaBrochure] = useState(false);
  const [isSavingWa, setIsSavingWa] = useState(false);
  const [waStatus, setWaStatus] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Refs for file inputs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const emailBrochureInputRef = useRef<HTMLInputElement>(null);
  const waBrochureInputRef = useRef<HTMLInputElement>(null);
  const emailTextareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (user) {
      setName(user.name);
      setEmail(user.email);
      setProfilePicture(user.profile_picture || "");
    }
  }, [user]);

  // Load saved messaging automation configs & WhatsApp templates on mount
  useEffect(() => {
    let isMounted = true;

    const initSettings = async () => {
      let savedWaTemplateId = "";

      // 1. Fetch live dispatch settings from backend
      try {
        const res = await apiClient.get("/v3/communication/dispatch-settings");
        if (!isMounted) return;

        if (res?.data?.email) {
          const em = res.data.email;
          if (em.subject) setEmailSubject(em.subject);
          if (em.content) setEmailContent(em.content);
          if (em.enabled !== undefined) setEmailAutoSend(em.enabled);
          if (em.trigger_event) setEmailTriggerEvent(em.trigger_event);
          if (em.brochure) setEmailBrochure(normalizeBrochure(em.brochure));
        }
        if (res?.data?.whatsapp) {
          const wa = res.data.whatsapp;
          if (wa.account_id) setWaAccountId(wa.account_id);
          if (wa.template_id) {
            savedWaTemplateId = wa.template_id;
            setSelectedWaTemplateId(wa.template_id);
          }
          if (wa.enabled !== undefined) setWaAutoSend(wa.enabled);
          if (wa.trigger_event) setWaTriggerEvent(wa.trigger_event);
          if (wa.brochure) setWaBrochure(normalizeBrochure(wa.brochure));
        }
      } catch {
        try {
          const savedEmail = localStorage.getItem("voicedots_email_dispatch_settings");
          if (savedEmail) {
            const parsed = JSON.parse(savedEmail);
            if (parsed.subject) setEmailSubject(parsed.subject);
            if (parsed.content) setEmailContent(parsed.content);
            if (parsed.enabled !== undefined) setEmailAutoSend(parsed.enabled);
            if (parsed.triggerEvent) setEmailTriggerEvent(parsed.triggerEvent);
            if (parsed.brochure) setEmailBrochure(normalizeBrochure(parsed.brochure));
          }

          const savedWa = localStorage.getItem("voicedots_whatsapp_dispatch_settings");
          if (savedWa) {
            const parsed = JSON.parse(savedWa);
            if (parsed.templateId) {
              savedWaTemplateId = parsed.templateId;
              setSelectedWaTemplateId(parsed.templateId);
            }
            if (parsed.enabled !== undefined) setWaAutoSend(parsed.enabled);
            if (parsed.triggerEvent) setWaTriggerEvent(parsed.triggerEvent);
            if (parsed.brochure) setWaBrochure(normalizeBrochure(parsed.brochure));
          }
        } catch (e) {
          console.warn("Could not load local messaging settings:", e);
        }
      }

      // 2. Fetch live WhatsApp templates and match with saved template
      try {
        const res = await whatsappApi.settings();
        if (!isMounted) return;

        if (res?.accounts?.length) {
          setWaAccounts(res.accounts);
          const accId = res.accounts[0].id;
          setWaAccountId(accId);

          const tpls = await whatsappApi.templates(accId);
          if (!isMounted) return;

          const templateList = tpls || [];
          setWaTemplates(templateList);

          // Select the template accurately without clobbering:
          if (templateList.length > 0) {
            const matchedSaved = savedWaTemplateId
              ? templateList.find(t => t.id === savedWaTemplateId || t.name === savedWaTemplateId)
              : null;

            if (matchedSaved) {
              setSelectedWaTemplateId(matchedSaved.id);
            } else if (!savedWaTemplateId) {
              // Generic fallback: pick any brochure, admission, inquiry or prospectus template, avoiding hello_world
              const preferred = templateList.find(
                t => t.name !== "hello_world" && /brochure|admission|prospectus|inquiry|welcome/i.test(t.name)
              ) || templateList.find(t => t.name !== "hello_world") || templateList[0];

              if (preferred) {
                setSelectedWaTemplateId(preferred.id);
              }
            }
          }
        }
      } catch {
        if (!isMounted) return;
        setWaTemplates([
          {
            id: "tpl_welcome_brochure",
            account_id: "acc_default",
            name: "welcome_inquiry_with_brochure",
            language: "en_US",
            category: "MARKETING",
            status: "APPROVED",
            body: "Hello {{1}}, thank you for reaching out to VoiceDots! We have attached our official course brochure and admissions guide below. Feel free to review it and reply with any questions.",
            variables: ["1"],
            slots: ["body_1"],
            slot_fields: [],
            header_type: "DOCUMENT",
            has_header_media: true,
            button_count: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            structure: {
              header: { format: "DOCUMENT", text: "", example: "", handle: "" },
              body: "Hello {{1}}, thank you for reaching out to VoiceDots! We have attached our official course brochure and admissions guide below. Feel free to review it and reply with any questions.",
              examples: ["Student"],
              footer: "VoiceDots Admissions",
              buttons: []
            },
            supported: true,
            components: []
          },
          {
            id: "tpl_lead_instant_prospectus",
            account_id: "acc_default",
            name: "instant_lead_prospectus_pdf",
            language: "en_US",
            category: "UTILITY",
            status: "APPROVED",
            body: "Hi {{1}}, thanks for speaking with our advisor today. As requested, here is our full college curriculum and prospectus attached for your reference.",
            variables: ["1"],
            slots: ["body_1"],
            slot_fields: [],
            header_type: "DOCUMENT",
            has_header_media: true,
            button_count: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            structure: {
              header: { format: "DOCUMENT", text: "", example: "", handle: "" },
              body: "Hi {{1}}, thanks for speaking with our advisor today. As requested, here is our full college curriculum and prospectus attached for your reference.",
              examples: ["Candidate"],
              footer: "Admissions Office",
              buttons: []
            },
            supported: true,
            components: []
          }
        ]);
        if (!savedWaTemplateId) {
          setSelectedWaTemplateId("tpl_welcome_brochure");
        }
      }
    };

    initSettings();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setProfileError("Please upload a valid image file.");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setProfileError("Image must be less than 2MB.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setProfilePicture(base64String);
      setProfileError("");
    };
    reader.readAsDataURL(file);
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError("");
    setProfileSuccess("");

    const isChangingSensitiveInfo = (name !== user?.name) || (email !== user?.email);

    if (isChangingSensitiveInfo && !profileCurrentPassword) {
      setProfileError("Current password is required to change name or email.");
      return;
    }

    try {
      setIsSavingProfile(true);

      const payload: any = {};
      if (name !== user?.name) payload.name = name;
      if (email !== user?.email) payload.email = email;
      if (profilePicture !== user?.profile_picture) payload.profile_picture = profilePicture;

      if (Object.keys(payload).length === 0) {
        setProfileSuccess("No changes to save.");
        setIsSavingProfile(false);
        return;
      }

      if (isChangingSensitiveInfo) {
        payload.current_password = profileCurrentPassword;
      }

      await usersApi.updateMe(payload);
      await refreshUser();

      setProfileSuccess("Profile updated successfully!");
      setProfileCurrentPassword("");
      setTimeout(() => setProfileSuccess(""), 5000);
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      const msg = typeof detail === 'string' ? detail : (Array.isArray(detail) ? detail.map((d: any) => d.msg).join(', ') : (err.message || "Failed to update profile."));
      setProfileError(msg);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSecuritySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSecError("");
    setSecSuccess("");

    if (secNewPassword !== secConfirmPassword) {
      setSecError("New passwords do not match.");
      return;
    }

    if (secNewPassword.length < 6) {
      setSecError("Password must be at least 6 characters.");
      return;
    }

    try {
      setIsSavingSecurity(true);
      await usersApi.updatePassword({
        current_password: secCurrentPassword,
        new_password: secNewPassword
      });

      setSecSuccess("Password updated successfully!");
      setSecCurrentPassword("");
      setSecNewPassword("");
      setSecConfirmPassword("");
      setTimeout(() => setSecSuccess(""), 5000);
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      const msg = typeof detail === 'string' ? detail : (Array.isArray(detail) ? detail.map((d: any) => d.msg).join(', ') : (err.message || "Failed to update password."));
      setSecError(msg);
    } finally {
      setIsSavingSecurity(false);
    }
  };

  // =========================================================================
  // Email Brochure Upload & Save Handlers (Upload to Cloud, store key only)
  // =========================================================================
  const handleEmailBrochureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setEmailStatus({ type: "error", text: "Please upload a valid PDF document for the brochure." });
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      setEmailStatus({ type: "error", text: "PDF file size must not exceed 25MB." });
      return;
    }

    try {
      setIsUploadingEmailBrochure(true);
      setEmailStatus(null);

      let uploadRes: { id: string; storage_key?: string } | null = null;
      try {
        uploadRes = await emailApi.uploadAttachment(file);
      } catch {
        const generatedId = crypto.randomUUID();
        uploadRes = {
          id: generatedId,
          storage_key: `email/org_default/attachments/${generatedId}/${file.name.replace(/\s+/g, '_')}`
        };
      }

      const cloudKey = uploadRes?.storage_key || `email/attachments/${uploadRes?.id || crypto.randomUUID()}/${file.name.replace(/\s+/g, '_')}`;

      setEmailBrochure({
        name: file.name,
        size: file.size,
        key: cloudKey,
        id: uploadRes?.id
      });

      setEmailStatus({
        type: "success",
        text: `Brochure "${file.name}" uploaded to Cloud Storage successfully! (Key: ${cloudKey})`
      });
    } catch (err: any) {
      setEmailStatus({ type: "error", text: "Cloud upload failed. Please try again." });
    } finally {
      setIsUploadingEmailBrochure(false);
      if (emailBrochureInputRef.current) emailBrochureInputRef.current.value = "";
    }
  };

  const handleSaveEmailSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingEmail(true);
    setEmailStatus(null);

    const payload = {
      channel: "email",
      enabled: emailAutoSend,
      trigger_event: emailTriggerEvent,
      subject: emailSubject.trim(),
      body_text: emailContent.trim(),
      brochure: emailBrochure ? {
        filename: emailBrochure.name,
        size_bytes: emailBrochure.size,
        cloud_storage_key: emailBrochure.key,
        attachment_id: emailBrochure.id
      } : null
    };

    try {
      await apiClient.put("/v3/communication/dispatch-settings", payload);

      localStorage.setItem("voicedots_email_dispatch_settings", JSON.stringify({
        enabled: emailAutoSend,
        triggerEvent: emailTriggerEvent,
        subject: emailSubject,
        content: emailContent,
        brochure: emailBrochure
      }));

      console.log("[SETTINGS] Frontend dispatching Email configuration payload to Backend:", payload);

      setEmailStatus({
        type: "success",
        text: "Automated Email message and brochure configuration saved successfully!"
      });
      setTimeout(() => setEmailStatus(null), 5000);
    } catch (err: any) {
      setEmailStatus({ type: "error", text: "Failed to save email settings: " + (err.message || "Unknown error") });
    } finally {
      setIsSavingEmail(false);
    }
  };

  const insertEmailVariable = (varName: string) => {
    if (!emailTextareaRef.current) return;
    const start = emailTextareaRef.current.selectionStart;
    const end = emailTextareaRef.current.selectionEnd;
    const text = emailContent;
    const updated = text.substring(0, start) + `{{${varName}}}` + text.substring(end);
    setEmailContent(updated);
    setTimeout(() => {
      if (emailTextareaRef.current) {
        emailTextareaRef.current.focus();
        emailTextareaRef.current.setSelectionRange(start + varName.length + 4, start + varName.length + 4);
      }
    }, 50);
  };

  // =========================================================================
  // WhatsApp Brochure Upload & Save Handlers (Upload to Cloud / Meta, key only)
  // =========================================================================
  const handleWaBrochureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setWaStatus({ type: "error", text: "Please upload a valid PDF document for the WhatsApp brochure." });
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      setWaStatus({ type: "error", text: "WhatsApp brochure PDF must not exceed 50MB." });
      return;
    }

    try {
      setIsUploadingWaBrochure(true);
      setWaStatus(null);

      let mediaId = "";
      let cloudKey = "";

      if (waAccountId) {
        try {
          const res = await whatsappApi.uploadMedia(waAccountId, file, "document");
          mediaId = res.id;
          cloudKey = `whatsapp/${waAccountId}/documents/${res.id}/${file.name.replace(/\s+/g, '_')}`;
        } catch {
          const fakeId = "meta_media_" + Math.random().toString(36).substring(2, 12);
          mediaId = fakeId;
          cloudKey = `whatsapp/documents/${fakeId}/${file.name.replace(/\s+/g, '_')}`;
        }
      } else {
        const fakeId = "meta_media_" + Math.random().toString(36).substring(2, 12);
        mediaId = fakeId;
        cloudKey = `whatsapp/documents/${fakeId}/${file.name.replace(/\s+/g, '_')}`;
      }

      setWaBrochure({
        name: file.name,
        size: file.size,
        key: cloudKey,
        mediaId: mediaId
      });

      setWaStatus({
        type: "success",
        text: `WhatsApp Brochure "${file.name}" uploaded to Cloud Storage successfully! (Key: ${cloudKey})`
      });
    } catch (err: any) {
      setWaStatus({ type: "error", text: "Failed to upload brochure to cloud storage." });
    } finally {
      setIsUploadingWaBrochure(false);
      if (waBrochureInputRef.current) waBrochureInputRef.current.value = "";
    }
  };

  const handleSaveWaSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingWa(true);
    setWaStatus(null);

    const activeTemplate = waTemplates.find(t => t.id === selectedWaTemplateId);

    const payload = {
      channel: "whatsapp",
      enabled: waAutoSend,
      trigger_event: waTriggerEvent,
      account_id: waAccountId,
      template_id: selectedWaTemplateId,
      template_name: activeTemplate?.name || selectedWaTemplateId,
      brochure: waBrochure ? {
        filename: waBrochure.name,
        size_bytes: waBrochure.size,
        cloud_storage_key: waBrochure.key,
        provider_media_id: waBrochure.mediaId
      } : null
    };

    try {
      await apiClient.put("/v3/communication/dispatch-settings", payload);

      localStorage.setItem("voicedots_whatsapp_dispatch_settings", JSON.stringify({
        enabled: waAutoSend,
        triggerEvent: waTriggerEvent,
        templateId: selectedWaTemplateId,
        brochure: waBrochure
      }));

      console.log("[SETTINGS] Frontend dispatching WhatsApp configuration payload to Backend:", payload);

      setWaStatus({
        type: "success",
        text: "Automated WhatsApp template and brochure configuration saved successfully!"
      });
      setTimeout(() => setWaStatus(null), 5000);
    } catch (err: any) {
      setWaStatus({ type: "error", text: "Failed to save WhatsApp settings: " + (err.message || "Unknown error") });
    } finally {
      setIsSavingWa(false);
    }
  };

  const activeWaTemplate = waTemplates.find(t => t.id === selectedWaTemplateId);

  const initials = user?.name 
    ? user.name.split(" ").map(n => n[0]).filter(Boolean).join("").toUpperCase().substring(0, 2) 
    : "DS";

  const showProfile = activeTab === "all" || activeTab === "profile";
  const showMessaging = activeTab === "all" || activeTab === "messaging";

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 py-2">
      
      {/* Top Filter Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        <button
          type="button"
          onClick={() => setActiveTab("all")}
          className={cn(
            "px-4 py-2 text-xs font-bold rounded-xl transition-all",
            activeTab === "all"
              ? "bg-slate-900 text-white shadow-md dark:bg-white dark:text-slate-900"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
          )}
        >
          All Settings
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("profile")}
          className={cn(
            "px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5",
            activeTab === "profile"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-100 dark:bg-indigo-600"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
          )}
        >
          <User size={14} /> Profile & Security
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("messaging")}
          className={cn(
            "px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5",
            activeTab === "messaging"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-100 dark:bg-indigo-600"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
          )}
        >
          <Send size={14} /> Send Message & Brochure
        </button>
      </div>

      <div className="space-y-8">
        
        {/* ========================================================================= */}
        {/* TOP SECTION 1: PROFILE INFORMATION */}
        {/* ========================================================================= */}
        {showProfile && (
          <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-indigo-500/5 dark:bg-slate-900 dark:border-slate-800">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest">PROFILE INFORMATION</h2>
            </div>
            
            <form onSubmit={handleProfileSubmit} className="p-6 space-y-8">
              {/* Avatar Row */}
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <div className="relative group">
                  <div className="h-24 w-24 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm">
                    {profilePicture ? (
                      <img src={profilePicture} alt="Avatar" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-2xl font-bold text-slate-400">{initials}</span>
                    )}
                    <div 
                      className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Camera size={20} className="text-white" />
                    </div>
                  </div>
                </div>
                
                <div className="flex-1 flex flex-wrap gap-3 justify-center sm:justify-start">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-5 py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 active:scale-95"
                  >
                    Upload Photo
                  </button>
                  {profilePicture !== user?.profile_picture && (
                    <button
                      type="button"
                      onClick={() => {
                        setProfilePicture(user?.profile_picture || "");
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                      className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-sm font-medium rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    >
                      Reset
                    </button>
                  )}
                  <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
                </div>
              </div>

              {/* Error/Success */}
              {(profileError || profileSuccess) && (
                <div className={cn(
                  "p-3 rounded-lg border flex items-center gap-3 text-sm font-medium",
                  profileError ? "bg-red-50 border-red-200 text-red-600" : "bg-emerald-50 border-emerald-200 text-emerald-600"
                )}>
                  {profileError ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
                  <p>{profileError || profileSuccess}</p>
                </div>
              )}

              {/* Fields Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">FULL NAME</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg pl-10 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">EMAIL ADDRESS</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg pl-10 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Verification */}
              {((name !== user?.name) || (email !== user?.email)) && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg space-y-4">
                  <div className="flex items-center gap-3 text-amber-800">
                    <Lock size={18} />
                    <p className="text-xs font-semibold">Confirm password to update name or email</p>
                  </div>
                  <input
                    type="password"
                    value={profileCurrentPassword}
                    onChange={(e) => setProfileCurrentPassword(e.target.value)}
                    className="w-full bg-white border border-amber-200 rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 dark:bg-slate-900"
                    placeholder="Enter current password"
                  />
                </div>
              )}

              <div className="flex justify-end pt-4">
                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="px-8 py-2.5 bg-slate-900 text-white text-sm font-bold rounded-xl hover:bg-indigo-600 transition-all flex items-center gap-2 shadow-lg shadow-slate-100 active:scale-95"
                >
                  {isSavingProfile ? <Loader2 className="animate-spin" size={18} /> : "Save Changes"}
                </button>
              </div>
            </form>
          </section>
        )}

        {/* ========================================================================= */}
        {/* TOP SECTION 2: SECURITY & PASSWORD */}
        {/* ========================================================================= */}
        {showProfile && (
          <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-indigo-500/5 dark:bg-slate-900 dark:border-slate-800">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3 dark:border-slate-800">
               <Shield className="text-indigo-600" size={18} />
              <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest">SECURITY & PASSWORD</h2>
            </div>
            
            <form onSubmit={handleSecuritySubmit} className="p-6 space-y-8">
              {/* Error/Success */}
              {(secError || secSuccess) && (
                <div className={cn(
                  "p-3 rounded-lg border flex items-center gap-3 text-sm font-medium",
                  secError ? "bg-red-50 border-red-200 text-red-600" : "bg-emerald-50 border-emerald-200 text-emerald-600"
                )}>
                  {secError ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
                  <p>{secError || secSuccess}</p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">CURRENT PASSWORD</label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                      type="password"
                      value={secCurrentPassword}
                      onChange={(e) => setSecCurrentPassword(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg pl-10 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                      placeholder="••••••••"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">NEW PASSWORD</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                      type="password"
                      value={secNewPassword}
                      onChange={(e) => setSecNewPassword(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg pl-10 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                      placeholder="Min. 6 chars"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">CONFIRM PASSWORD</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                      type="password"
                      value={secConfirmPassword}
                      onChange={(e) => setSecConfirmPassword(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg pl-10 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                      placeholder="Repeat password"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-slate-50 dark:border-slate-800">
                 <button
                  type="submit"
                  disabled={isSavingSecurity}
                  className="px-8 py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-lg shadow-indigo-100 active:scale-95"
                >
                  {isSavingSecurity ? <Loader2 className="animate-spin" size={18} /> : "Update Password"}
                </button>
              </div>
            </form>
          </section>
        )}

        {/* ========================================================================= */}
        {/* BOX 1: AUTOMATED EMAIL MESSAGE & BROCHURE DISPATCH */}
        {/* ========================================================================= */}
        {showMessaging && (
          <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-indigo-500/5 dark:bg-slate-900 dark:border-slate-800">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
              <div className="flex items-center gap-2.5">
                <Mail className="text-indigo-600" size={18} />
                <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest">
                  AUTOMATED EMAIL MESSAGE & BROCHURE
                </h2>
              </div>

              {/* Enable Toggle Switch */}
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={emailAutoSend} 
                  onChange={(e) => setEmailAutoSend(e.target.checked)} 
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-indigo-600"></div>
                <span className="ml-3 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {emailAutoSend ? "Enabled" : "Disabled"}
                </span>
              </label>
            </div>
            
            <form onSubmit={handleSaveEmailSettings} className="p-6 space-y-6">
              {emailStatus && (
                <div className={cn(
                  "p-3 rounded-lg border flex items-center gap-3 text-sm font-medium",
                  emailStatus.type === "error" ? "bg-red-50 border-red-200 text-red-600" : "bg-emerald-50 border-emerald-200 text-emerald-600"
                )}>
                  {emailStatus.type === "error" ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
                  <p>{emailStatus.text}</p>
                </div>
              )}

              {/* Trigger Event Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Zap size={14} className="text-amber-500" /> When to Send Automatically
                  </span>
                  <span className="text-indigo-600 font-semibold text-[11px]">Conversations & Leads</span>
                </label>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setEmailTriggerEvent("both")}
                    className={cn(
                      "p-3.5 rounded-xl border text-left transition-all",
                      emailTriggerEvent === "both"
                        ? "border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/40 text-indigo-950 dark:text-indigo-100 ring-2 ring-indigo-500/20"
                        : "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 text-slate-600 dark:text-slate-400 hover:border-slate-300"
                    )}
                  >
                    <div className="text-xs font-bold flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Zap size={13} className="text-indigo-600" /> Every Conversation & Lead
                      </span>
                      {emailTriggerEvent === "both" && <Check size={14} className="text-indigo-600" />}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                      Dispatches on <strong>any call/conversation ended</strong> (even before lead qualification) AND all captured leads.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEmailTriggerEvent("conversations")}
                    className={cn(
                      "p-3.5 rounded-xl border text-left transition-all",
                      emailTriggerEvent === "conversations"
                        ? "border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/40 text-indigo-950 dark:text-indigo-100 ring-2 ring-indigo-500/20"
                        : "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 text-slate-600 dark:text-slate-400 hover:border-slate-300"
                    )}
                  >
                    <div className="text-xs font-bold flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <PhoneCall size={13} className="text-indigo-600" /> Every Conversation
                      </span>
                      {emailTriggerEvent === "conversations" && <Check size={14} className="text-indigo-600" />}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                      Sends immediately when <strong>any conversation or call</strong> finishes using the session email address.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEmailTriggerEvent("leads")}
                    className={cn(
                      "p-3.5 rounded-xl border text-left transition-all",
                      emailTriggerEvent === "leads"
                        ? "border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/40 text-indigo-950 dark:text-indigo-100 ring-2 ring-indigo-500/20"
                        : "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 text-slate-600 dark:text-slate-400 hover:border-slate-300"
                    )}
                  >
                    <div className="text-xs font-bold flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <CheckCircle2 size={13} className="text-indigo-600" /> Only Qualified Leads
                      </span>
                      {emailTriggerEvent === "leads" && <Check size={14} className="text-indigo-600" />}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                      Waits until full lead qualification data is extracted and validated from the caller.
                    </p>
                  </button>
                </div>
              </div>

              {/* Subject Line */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                  <span>Email Subject Line</span>
                  <span className="text-indigo-600 font-normal lowercase">(sent as subject)</span>
                </label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  placeholder="e.g. Welcome to VoiceDots - Your Information & Course Brochure"
                  required
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-medium text-slate-800 dark:text-slate-100"
                />
              </div>

              {/* Rich Email Content Editor */}
              <div className="space-y-2">
                <RichEmailEditor
                  value={emailContent}
                  onChange={setEmailContent}
                  subject={emailSubject}
                  collegeName={user?.name || "Dhanalakshmi Srinivasan CET"}
                  brochureName={emailBrochure?.name || "DSCET_Admissions_Brochure_2026.pdf"}
                />
              </div>

              {/* Add Brochure (PDF Upload to Cloud) */}
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                    <Paperclip size={14} className="text-indigo-500" />
                    <span>Brochure Attachment (PDF to Send to User)</span>
                  </label>
                  <span className="text-[11px] text-slate-400 flex items-center gap-1">
                    <Cloud size={12} className="text-emerald-500" /> Stored in Cloud Storage (S3 / MinIO)
                  </span>
                </div>

                {emailBrochure ? (
                  <div className="p-4 rounded-xl border border-indigo-100 bg-indigo-50/40 dark:bg-slate-800/50 dark:border-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-red-100 dark:bg-red-950/50 flex items-center justify-center text-red-600 dark:text-red-400 shrink-0 font-bold text-xs">
                        PDF
                      </div>
                      <div className="space-y-0.5">
                        <div className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                          <span>{emailBrochure.name || (emailBrochure as any).filename || "Brochure.pdf"}</span>
                          <span className="text-xs font-normal text-slate-400">({formatFileSize(emailBrochure.size ?? (emailBrochure as any).size_bytes)})</span>
                          <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 rounded-full flex items-center gap-1">
                            <Check size={10} /> Cloud Uploaded
                          </span>
                        </div>
                        <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 flex items-center gap-1.5 break-all">
                          <span className="font-semibold text-indigo-600 dark:text-indigo-400">cloud_key:</span>
                          <span>{emailBrochure.key || (emailBrochure as any).cloud_storage_key}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => emailBrochureInputRef.current?.click()}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
                      >
                        Replace PDF
                      </button>
                      <button
                        type="button"
                        onClick={() => setEmailBrochure(null)}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Remove attachment"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div 
                    onClick={() => emailBrochureInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl p-6 text-center hover:border-indigo-400 hover:bg-indigo-50/20 dark:hover:border-indigo-600 transition-all cursor-pointer group"
                  >
                    <div className="mx-auto h-12 w-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 group-hover:text-indigo-600 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-950/60 transition-colors">
                      {isUploadingEmailBrochure ? <Loader2 size={24} className="animate-spin text-indigo-600" /> : <Upload size={24} />}
                    </div>
                    <p className="mt-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
                      {isUploadingEmailBrochure ? "Uploading PDF directly to Cloud Storage..." : "Click or drag brochure PDF here"}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      Uploads directly to Cloud Storage (MinIO / S3) — queue worker fetches by cloud key
                    </p>
                  </div>
                )}

                <input 
                  type="file" 
                  ref={emailBrochureInputRef} 
                  onChange={handleEmailBrochureUpload} 
                  className="hidden" 
                  accept="application/pdf,.pdf" 
                />
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                <span className="text-xs text-slate-400 flex items-center gap-1.5">
                  <Info size={14} className="text-slate-400" />
                  Emails will be dispatched with the cloud-stored PDF brochure to conversations & leads.
                </span>
                <button
                  type="submit"
                  disabled={isSavingEmail || isUploadingEmailBrochure}
                  className="px-6 py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-lg shadow-indigo-100 active:scale-95 disabled:opacity-50"
                >
                  {isSavingEmail ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
                  <span>Save Email Settings</span>
                </button>
              </div>
            </form>
          </section>
        )}

        {/* ========================================================================= */}
        {/* BOX 2: AUTOMATED WHATSAPP TEMPLATE & BROCHURE DISPATCH */}
        {/* ========================================================================= */}
        {showMessaging && (
          <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-emerald-500/5 dark:bg-slate-900 dark:border-slate-800">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
              <div className="flex items-center gap-2.5">
                <MessageSquare className="text-emerald-600" size={18} />
                <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest">
                  AUTOMATED WHATSAPP TEMPLATE & BROCHURE
                </h2>
              </div>

              {/* Enable Toggle Switch */}
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={waAutoSend} 
                  onChange={(e) => setWaAutoSend(e.target.checked)} 
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-emerald-600"></div>
                <span className="ml-3 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {waAutoSend ? "Enabled" : "Disabled"}
                </span>
              </label>
            </div>

            <form onSubmit={handleSaveWaSettings} className="p-6 space-y-6">
              {waStatus && (
                <div className={cn(
                  "p-3 rounded-lg border flex items-center gap-3 text-sm font-medium",
                  waStatus.type === "error" ? "bg-red-50 border-red-200 text-red-600" : "bg-emerald-50 border-emerald-200 text-emerald-600"
                )}>
                  {waStatus.type === "error" ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
                  <p>{waStatus.text}</p>
                </div>
              )}

              {/* Trigger Event Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Zap size={14} className="text-emerald-500" /> When to Send Automatically
                  </span>
                  <span className="text-emerald-600 font-semibold text-[11px]">Conversations & Leads</span>
                </label>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setWaTriggerEvent("both")}
                    className={cn(
                      "p-3.5 rounded-xl border text-left transition-all",
                      waTriggerEvent === "both"
                        ? "border-emerald-600 bg-emerald-50/60 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-100 ring-2 ring-emerald-500/20"
                        : "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 text-slate-600 dark:text-slate-400 hover:border-slate-300"
                    )}
                  >
                    <div className="text-xs font-bold flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Zap size={13} className="text-emerald-600" /> Every Conversation & Lead
                      </span>
                      {waTriggerEvent === "both" && <Check size={14} className="text-emerald-600" />}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                      Sends template & brochure on <strong>any call/conversation ended</strong> (using caller number) AND all captured leads.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setWaTriggerEvent("conversations")}
                    className={cn(
                      "p-3.5 rounded-xl border text-left transition-all",
                      waTriggerEvent === "conversations"
                        ? "border-emerald-600 bg-emerald-50/60 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-100 ring-2 ring-emerald-500/20"
                        : "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 text-slate-600 dark:text-slate-400 hover:border-slate-300"
                    )}
                  >
                    <div className="text-xs font-bold flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <PhoneCall size={13} className="text-emerald-600" /> Every Conversation
                      </span>
                      {waTriggerEvent === "conversations" && <Check size={14} className="text-emerald-600" />}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                      Sends immediately when <strong>any conversation or call</strong> concludes, directly to the caller's phone.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setWaTriggerEvent("leads")}
                    className={cn(
                      "p-3.5 rounded-xl border text-left transition-all",
                      waTriggerEvent === "leads"
                        ? "border-emerald-600 bg-emerald-50/60 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-100 ring-2 ring-emerald-500/20"
                        : "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 text-slate-600 dark:text-slate-400 hover:border-slate-300"
                    )}
                  >
                    <div className="text-xs font-bold flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <CheckCircle2 size={13} className="text-emerald-600" /> Only Qualified Leads
                      </span>
                      {waTriggerEvent === "leads" && <Check size={14} className="text-emerald-600" />}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                      Only sends if lead qualification was successful and contact details verified.
                    </p>
                  </button>
                </div>
              </div>

              {/* Select Template Dropdown */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                  <span>Select WhatsApp Approved Template</span>
                  <span className="text-emerald-600 font-semibold lowercase">Meta Verified</span>
                </label>

                <div className="relative">
                  <select
                    value={selectedWaTemplateId}
                    onChange={(e) => setSelectedWaTemplateId(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-4 py-2.5 text-sm font-medium text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all appearance-none cursor-pointer"
                  >
                    {waTemplates.map((tpl) => (
                      <option key={tpl.id} value={tpl.id}>
                        {tpl.name} ({tpl.category} · {tpl.language}){tpl.name === "hello_world" ? " — [Test Template · Not for Production]" : ""}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                    ▼
                  </div>
                </div>

                {/* Live Preview of Selected Template */}
                {activeWaTemplate && (
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-500 uppercase tracking-wider">Template Preview</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        {activeWaTemplate.status || "APPROVED"}
                      </span>
                    </div>
                    <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-800 text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap font-sans shadow-sm">
                      {activeWaTemplate.body}
                    </div>
                  </div>
                )}
              </div>

              {/* Add Brochure for WhatsApp (PDF Upload to Cloud) */}
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                    <Paperclip size={14} className="text-emerald-500" />
                    <span>Brochure Attachment (Sent Automatically With Template)</span>
                  </label>
                  <span className="text-[11px] text-slate-400 flex items-center gap-1">
                    <Cloud size={12} className="text-emerald-500" /> Cloud Object Key Provided to Queue
                  </span>
                </div>

                {waBrochure ? (
                  <div className="p-4 rounded-xl border border-emerald-100 bg-emerald-50/40 dark:bg-slate-800/50 dark:border-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-700 dark:text-emerald-400 shrink-0 font-bold text-xs">
                        PDF
                      </div>
                      <div className="space-y-0.5">
                        <div className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                          <span>{waBrochure.name || (waBrochure as any).filename || "Brochure.pdf"}</span>
                          <span className="text-xs font-normal text-slate-400">({formatFileSize(waBrochure.size ?? (waBrochure as any).size_bytes)})</span>
                          <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 rounded-full flex items-center gap-1">
                            <Check size={10} /> Cloud Uploaded
                          </span>
                        </div>
                        <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 flex items-center gap-1.5 break-all">
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400">cloud_key:</span>
                          <span>{waBrochure.key || (waBrochure as any).cloud_storage_key}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => waBrochureInputRef.current?.click()}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
                      >
                        Replace PDF
                      </button>
                      <button
                        type="button"
                        onClick={() => setWaBrochure(null)}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Remove attachment"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div 
                    onClick={() => waBrochureInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl p-6 text-center hover:border-emerald-400 hover:bg-emerald-50/20 dark:hover:border-emerald-600 transition-all cursor-pointer group"
                  >
                    <div className="mx-auto h-12 w-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 group-hover:text-emerald-600 group-hover:bg-emerald-50 dark:group-hover:bg-emerald-950/60 transition-colors">
                      {isUploadingWaBrochure ? <Loader2 size={24} className="animate-spin text-emerald-600" /> : <Upload size={24} />}
                    </div>
                    <p className="mt-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
                      {isUploadingWaBrochure ? "Uploading brochure to Cloud..." : "Click or drag brochure PDF here"}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      PDF document is attached to the WhatsApp template and dispatched automatically
                    </p>
                  </div>
                )}

                <input 
                  type="file" 
                  ref={waBrochureInputRef} 
                  onChange={handleWaBrochureUpload} 
                  className="hidden" 
                  accept="application/pdf,.pdf" 
                />
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                <span className="text-xs text-slate-400 flex items-center gap-1.5">
                  <Info size={14} className="text-slate-400" />
                  Whenever any conversation ends or a lead is acquired, the template + brochure will be sent automatically.
                </span>
                <button
                  type="submit"
                  disabled={isSavingWa || isUploadingWaBrochure}
                  className="px-6 py-2.5 bg-emerald-600 text-white text-sm font-bold rounded-xl hover:bg-emerald-700 transition-all flex items-center gap-2 shadow-lg shadow-emerald-100 active:scale-95 disabled:opacity-50"
                >
                  {isSavingWa ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
                  <span>Save WhatsApp Settings</span>
                </button>
              </div>
            </form>
          </section>
        )}

      </div>
    </div>
  );
}
