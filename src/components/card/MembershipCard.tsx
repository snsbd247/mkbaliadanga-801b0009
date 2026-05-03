import { QRCodeSVG } from "qrcode.react";
import { User } from "lucide-react";
import { TEMPLATES, type TemplateId } from "./templates";

export interface CardData {
  company_name: string;
  company_name_bn?: string;
  logo_url?: string | null;
  farmer: {
    name: string;
    name_en?: string;
    farmer_code?: string;
    member_no?: string;
    account_number?: string | null;
    voter_number?: string | null;
    mobile?: string;
    village?: string;
    address?: string;
    photo_url?: string | null;
  };
  /** Legacy QR token (deprecated). When `qr_value` is provided, it overrides this. */
  token: string;
  /** Preferred QR payload — typically a /scan?acc=<account_number> URL. */
  qr_value?: string;
  issued_at: string;
}

export interface CardDisplayOptions {
  show_photo?: boolean;
  show_account_number?: boolean;
  show_voter_number?: boolean;
  show_issue_date?: boolean;
  show_qr?: boolean;
}

interface Props {
  data: CardData;
  templateId?: TemplateId;
  display?: CardDisplayOptions;
}

/** Standard CR80 card: 85.6mm × 54mm. */
export function MembershipCard({ data, templateId = "classic", display }: Props) {
  const f = data.farmer;
  const opts = {
    show_photo: true, show_account_number: true, show_voter_number: true,
    show_issue_date: true, show_qr: true, ...display,
  };
  const qrValue = data.qr_value || data.token;
  const issued = new Date(data.issued_at).toLocaleDateString();
  const tpl = TEMPLATES[templateId] ?? TEMPLATES.classic;
  const headerTitle = tpl.bnFirst
    ? data.company_name_bn || data.company_name
    : data.company_name;
  const headerSub = tpl.bnFirst
    ? data.company_name
    : data.company_name_bn;

  return (
    <div className="flex flex-wrap gap-4 print:gap-2" data-testid="membership-card" data-template={templateId}>
      {/* FRONT */}
      <div
        className={`bg-white text-gray-900 rounded-lg shadow-elegant overflow-hidden border print:shadow-none ${tpl.bodyFontClass}`}
        style={{ width: "85.6mm", height: "54mm" }}
      >
        <div className="h-full flex flex-col">
          <div className={`flex items-center gap-2 px-2 py-1 ${tpl.headerClass}`}>
            {data.logo_url ? (
              <img src={data.logo_url} alt="" className="h-6 w-6 rounded object-cover" crossOrigin="anonymous" />
            ) : (
              <div className="h-6 w-6 rounded bg-white/20" />
            )}
            <div className="text-[9px] leading-tight font-semibold truncate">
              {headerTitle}
              {headerSub && <div className="text-[7px] font-normal opacity-80 truncate">{headerSub}</div>}
            </div>
            <div className="ml-auto text-[7px] opacity-80">Member ID</div>
          </div>
          <div className="flex-1 flex items-center gap-2 p-2">
            {opts.show_photo && (
              <div className="h-16 w-12 shrink-0 rounded border bg-gray-50 overflow-hidden flex items-center justify-center">
                {f.photo_url ? (
                  <img src={f.photo_url} alt="" className="h-full w-full object-cover" crossOrigin="anonymous" />
                ) : (
                  <User className="h-6 w-6 text-gray-300" />
                )}
              </div>
            )}
            <div className="min-w-0 flex-1 text-[9px] leading-tight space-y-0.5">
              <div className="font-bold text-[11px] truncate">{f.name}</div>
              {f.name_en && f.name_en !== f.name && <div className="text-gray-500 truncate">{f.name_en}</div>}
              {opts.show_account_number && f.account_number && (
                <div><span className="text-gray-500">A/C:</span> <span className="font-mono" data-testid="card-account">{f.account_number}</span></div>
              )}
              {opts.show_voter_number && f.voter_number && (
                <div><span className="text-gray-500">Voter:</span> <span className="font-mono" data-testid="card-voter">{f.voter_number}</span></div>
              )}
              {opts.show_issue_date && (
                <div><span className="text-gray-500">Issued:</span> {issued}</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* BACK */}
      <div
        className={`bg-white text-gray-900 rounded-lg shadow-elegant overflow-hidden border print:shadow-none ${tpl.bodyFontClass}`}
        style={{ width: "85.6mm", height: "54mm" }}
      >
        <div className="h-full flex p-2 gap-2">
          <div className="flex-1 min-w-0 text-[8px] leading-tight space-y-1">
            <div className="font-semibold text-[9px] border-b pb-0.5">Contact</div>
            {f.village && <div><span className="text-gray-500">Village:</span> {f.village}</div>}
            {f.address && <div className="line-clamp-3"><span className="text-gray-500">Address:</span> {f.address}</div>}
            {f.mobile && <div><span className="text-gray-500">Mobile:</span> <span className="font-mono">{f.mobile}</span></div>}
            <div className="pt-1 text-[7px] text-gray-500">If found, please return to the issuing office.</div>
          </div>
          {opts.show_qr && (
            <div className="flex flex-col items-center justify-center shrink-0">
              <div className="bg-white p-0.5 border rounded">
                <QRCodeSVG value={qrValue} size={90} level="M" includeMargin={false} />
              </div>
              <div className="text-[6px] text-gray-500 mt-0.5">Scan to pay</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
