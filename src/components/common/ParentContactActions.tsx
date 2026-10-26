import React from 'react';
import { Phone, MessageCircle } from 'lucide-react';
import { formatTelHref, formatWhatsAppUrl, isValidPhoneNumber } from '../../utils/phoneUtils';

interface ParentContactActionsProps {
  phone?: string | null;
  parentName?: string;
  studentName?: string;
  size?: 'sm' | 'md';
  showNumber?: boolean;
  className?: string;
}

export const ParentContactActions: React.FC<ParentContactActionsProps> = ({
  phone,
  parentName,
  studentName,
  size = 'sm',
  showNumber = false,
  className = ''
}) => {
  if (!phone || !isValidPhoneNumber(phone)) {
    return (
      <span style={{ fontSize: size === 'sm' ? '11.5px' : '13px', color: '#94A3B8', fontStyle: 'italic' }}>
        No contact number
      </span>
    );
  }

  const telHref = formatTelHref(phone);
  const defaultWhatsAppMsg = studentName
    ? `Hello ${parentName || 'Parent'}, reaching out regarding ${studentName} from Tutorly Tuition Center.`
    : `Hello ${parentName || 'Parent'}, reaching out from Tutorly Tuition Center.`;
  const whatsAppUrl = formatWhatsAppUrl(phone, defaultWhatsAppMsg);

  const isSmall = size === 'sm';
  const iconSize = isSmall ? 12 : 14;

  return (
    <div
      className={`parent-contact-actions ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        flexWrap: 'wrap'
      }}
    >
      {showNumber && (
        <span style={{ fontSize: isSmall ? '12px' : '13.5px', color: '#334155', fontWeight: 500, marginRight: '2px' }}>
          {phone}
        </span>
      )}

      {/* Call Action Link */}
      <a
        href={telHref}
        className="btn btn-secondary"
        style={{
          padding: isSmall ? '3px 8px' : '6px 12px',
          fontSize: isSmall ? '11px' : '12.5px',
          fontWeight: 600,
          color: '#1D4ED8',
          backgroundColor: '#EFF6FF',
          borderColor: '#BFDBFE',
          borderRadius: '6px',
          textDecoration: 'none',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          lineHeight: 1
        }}
        title={`Call ${parentName || 'Parent'} (${phone})`}
        aria-label={`Call ${parentName || 'Parent'}`}
      >
        <Phone size={iconSize} color="#2563EB" />
        <span>Call</span>
      </a>

      {/* WhatsApp Action Link */}
      <a
        href={whatsAppUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="btn btn-secondary"
        style={{
          padding: isSmall ? '3px 8px' : '6px 12px',
          fontSize: isSmall ? '11px' : '12.5px',
          fontWeight: 600,
          color: '#15803D',
          backgroundColor: '#F0FDF4',
          borderColor: '#BBF7D0',
          borderRadius: '6px',
          textDecoration: 'none',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          lineHeight: 1
        }}
        title={`WhatsApp message to ${parentName || 'Parent'} (${phone})`}
        aria-label={`WhatsApp message to ${parentName || 'Parent'}`}
      >
        <MessageCircle size={iconSize} color="#16A34A" />
        <span>WhatsApp</span>
      </a>
    </div>
  );
};
