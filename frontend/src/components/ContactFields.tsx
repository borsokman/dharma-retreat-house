import type { GuestContact } from "../api/types";
import { isValidEmail } from "../utils/format";

export const emptyContact: GuestContact = { name: "", email: "", phone: "" };

export function isContactComplete(contact: GuestContact): boolean {
  return (
    contact.name.trim() !== "" &&
    isValidEmail(contact.email) &&
    contact.phone.trim() !== ""
  );
}

interface ContactFieldsProps {
  /** Prefix that keeps input ids unique per form. */
  idPrefix: string;
  contact: GuestContact;
  onContactChange: (contact: GuestContact) => void;
  requests: string;
  onRequestsChange: (requests: string) => void;
}

const fields: {
  key: keyof GuestContact;
  label: string;
  type: string;
  autoComplete: string;
}[] = [
  { key: "name", label: "Full name", type: "text", autoComplete: "name" },
  { key: "email", label: "Email", type: "email", autoComplete: "email" },
  { key: "phone", label: "Telephone", type: "tel", autoComplete: "tel" },
];

/** Guest name / email / phone / special-requests inputs for booking forms. */
export function ContactFields({
  idPrefix,
  contact,
  onContactChange,
  requests,
  onRequestsChange,
}: ContactFieldsProps) {
  return (
    <>
      {fields.map((f) => (
        <div className="field" key={f.key}>
          <label htmlFor={`${idPrefix}-${f.key}`}>{f.label}</label>
          <input
            id={`${idPrefix}-${f.key}`}
            className="input"
            type={f.type}
            required
            autoComplete={f.autoComplete}
            value={contact[f.key]}
            onChange={(e) =>
              onContactChange({ ...contact, [f.key]: e.target.value })
            }
          />
        </div>
      ))}
      <div className="field">
        <label htmlFor={`${idPrefix}-requests`}>
          Special requests (optional)
        </label>
        <textarea
          id={`${idPrefix}-requests`}
          className="input"
          rows={3}
          value={requests}
          onChange={(e) => onRequestsChange(e.target.value)}
        />
      </div>
    </>
  );
}
