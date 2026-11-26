// Replace the trusted SVG artwork here and bump the corresponding style version in domain.
export const backgrounds = {
  paper: { background: "#f6f1e7", foreground: "#293e31", accent: "#aebaa4" },
  forest: { background: "#18382e", foreground: "#fff8e8", accent: "#718d76" },
};
export function backgroundSvg(style: keyof typeof backgrounds, width: number, height: number) {
  const c = backgrounds[style];
  return '<rect width="'+width+'" height="'+height+'" fill="'+c.background+'"/><circle cx="'+width+'" cy="0" r="420" fill="'+c.accent+'" opacity=".12"/><path d="M0 '+height+' Q260 '+(height-350)+' 450 '+height+'" fill="'+c.accent+'" opacity=".16"/><rect x="36" y="36" width="'+(width-72)+'" height="'+(height-72)+'" rx="20" fill="none" stroke="'+c.accent+'" opacity=".5"/>';
}
