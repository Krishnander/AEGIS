export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-border border-t-foreground/50 rounded-full animate-spin mx-auto mb-3"></div>
        <p className="text-muted-foreground text-2xs uppercase tracking-wider">Loading AEGIS...</p>
      </div>
    </div>
  );
}
