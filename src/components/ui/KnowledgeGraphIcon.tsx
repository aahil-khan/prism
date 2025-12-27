import React from "react"

interface KnowledgeGraphIconProps {
  className?: string
  color?: string
}

export const KnowledgeGraphIcon: React.FC<KnowledgeGraphIconProps> = ({
  className = "h-5 w-5",
  color = "currentColor",
}) => {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* Center node */}
      <circle cx="12" cy="12" r="2" fill={color} />
      
      {/* Connected nodes */}
      {/* Top node */}
      <circle cx="12" cy="4" r="1.5" fill={color} />
      {/* Bottom node */}
      <circle cx="12" cy="20" r="1.5" fill={color} />
      {/* Left node */}
      <circle cx="4" cy="12" r="1.5" fill={color} />
      {/* Right node */}
      <circle cx="20" cy="12" r="1.5" fill={color} />
      
      {/* Top-left diagonal node */}
      <circle cx="6.5" cy="6.5" r="1.5" fill={color} />
      {/* Top-right diagonal node */}
      <circle cx="17.5" cy="6.5" r="1.5" fill={color} />
      {/* Bottom-left diagonal node */}
      <circle cx="6.5" cy="17.5" r="1.5" fill={color} />
      {/* Bottom-right diagonal node */}
      <circle cx="17.5" cy="17.5" r="1.5" fill={color} />
      
      {/* Connection lines from center to all nodes */}
      <line x1="12" y1="12" x2="12" y2="4" stroke={color} />
      <line x1="12" y1="12" x2="12" y2="20" stroke={color} />
      <line x1="12" y1="12" x2="4" y2="12" stroke={color} />
      <line x1="12" y1="12" x2="20" y2="12" stroke={color} />
      <line x1="12" y1="12" x2="6.5" y2="6.5" stroke={color} />
      <line x1="12" y1="12" x2="17.5" y2="6.5" stroke={color} />
      <line x1="12" y1="12" x2="6.5" y2="17.5" stroke={color} />
      <line x1="12" y1="12" x2="17.5" y2="17.5" stroke={color} />
    </svg>
  )
}
