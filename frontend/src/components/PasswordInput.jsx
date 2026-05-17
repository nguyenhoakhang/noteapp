// src/components/PasswordInput.jsx — Reusable password input with visibility toggle + strength meter
import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

const STRENGTH_LABELS = ['Weak', 'Fair', 'Good', 'Strong']
const STRENGTH_COLORS = ['#ef4444', '#f59e0b', '#10b981', '#059669']

function getStrength(pw) {
  let score = 0
  if (pw.length >= 8) score++
  if (pw.length >= 12) score++
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++
  if (/\d/.test(pw)) score++
  if (/[^a-zA-Z0-9]/.test(pw)) score++
  return Math.min(score, 3)
}

export default function PasswordInput({
  value,
  onChange,
  label,
  placeholder,
  showStrength = false,
  required = false,
  minLength,
  autoFocus,
  id,
}) {
  const [visible, setVisible] = useState(false)
  const strength = showStrength && value ? getStrength(value) : -1

  return (
    <div className="form-group">
      {label && <label>{label}</label>}
      <div className="password-wrap">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          required={required}
          minLength={minLength}
          autoFocus={autoFocus}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="password-input"
        />
        <button
          type="button"
          className="password-toggle"
          onClick={() => setVisible((v) => !v)}
          tabIndex={-1}
          aria-label={visible ? 'Hide password' : 'Show password'}
        >
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      {strength >= 0 && (
        <div className="password-strength">
          <div className="strength-bar">
            <div
              className="strength-fill"
              style={{
                width: `${((strength + 1) / 4) * 100}%`,
                background: STRENGTH_COLORS[strength],
              }}
            />
          </div>
          <span className="strength-label" style={{ color: STRENGTH_COLORS[strength] }}>
            {STRENGTH_LABELS[strength]}
          </span>
        </div>
      )}
    </div>
  )
}
