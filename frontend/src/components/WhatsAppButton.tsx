import { MessageCircle } from "lucide-react";
import { site } from "../data/site";

export function WhatsAppButton({ label = "Chat with the front desk" }) {
  return (
    <a
      className="btn btn--whatsapp"
      href={site.whatsapp.url}
      target="_blank"
      rel="noreferrer"
      aria-label={`${label} on WhatsApp (${site.whatsapp.number})`}
    >
      <MessageCircle size={19} aria-hidden="true" /> {label}
    </a>
  );
}
