diff --git a/app/page.tsx b/app/page.tsx
--- a/app/page.tsx
+++ b/app/page.tsx
@@ -1,6 +1,7 @@
   const [toast, setToast] = useState("");
   const [theme, setTheme] = useState<"dark" | "light">("dark");
   const [accentIndex, setAccentIndex] = useState(0);
+  const [currentTime, setCurrentTime] = useState<number | null>(null);
   const [paletteOpen, setPaletteOpen] = useState(false);
   const [activeSection, setActiveSection] = useState("overview");
   const [repoQuery, setRepoQuery] = useState("");
@@ -1,31 +1,37 @@
-  useEffect(() => {
-  
-  useEffect(() => {
-    try {
-      const savedTheme = window.localStorage.getItem("orbit-theme");
-      if (savedTheme === "light" || savedTheme === "dark") {
-        window.setTimeout(() => setTheme(savedTheme), 0);
-      }
-
-      const savedAccent = window.localStorage.getItem("orbit-accent");
-      const savedAccentIndex = accents.findIndex((item) => item.name === savedAccent);
-      if (savedAccentIndex >= 0) {
-        window.setTimeout(() => setAccentIndex(savedAccentIndex), 0);
-      }
-    } catch {
-      // Local storage may be disabled; the dashboard remains usable without saved preferences.
-    }
-
-    const params = new URLSearchParams(window.location.search);
-    const fromUrl = params.get("username");
-    const rangeParam = params.get("range");
-    const validRange = dateRanges.some((item) => item.key === rangeParam)
-      ? rangeParam as RangeKey
-      : "year";
-
-    if (fromUrl) {
-      setUsername(fromUrl);
-      setRange(validRange);
-      void loadProfile(fromUrl, validRange);
-    }
-  }, [loadProfile]);
+  useEffect(() => {
+    const timeouts: number[] = [];
+
+    try {
+      const savedTheme = window.localStorage.getItem("orbit-theme");
+      if (savedTheme === "light" || savedTheme === "dark") {
+        timeouts.push(window.setTimeout(() => setTheme(savedTheme), 0));
+      }
+
+      const savedAccent = window.localStorage.getItem("orbit-accent");
+      const savedAccentIndex = accents.findIndex((item) => item.name === savedAccent);
+      if (savedAccentIndex >= 0) {
+        timeouts.push(window.setTimeout(() => setAccentIndex(savedAccentIndex), 0));
+      }
+    } catch {
+      // Local storage may be disabled; the dashboard remains usable without saved preferences.
+    }
+
+    const params = new URLSearchParams(window.location.search);
+    const fromUrl = params.get("username");
+    const rangeParam = params.get("range");
+    const validRange = dateRanges.some((item) => item.key === rangeParam)
+      ? rangeParam as RangeKey
+      : "year";
+
+    if (fromUrl) {
+      timeouts.push(window.setTimeout(() => {
+        setUsername(fromUrl);
+        setRange(validRange);
+      }, 0));
+      void loadProfile(fromUrl, validRange);
+    }
+
+    return () => {
+      timeouts.forEach((timeout) => window.clearTimeout(timeout));
+    };
+  }, [loadProfile]);
@@ -1,3 +1,8 @@
+  useEffect(() => {
+    const timeout = window.setTimeout(() => setCurrentTime(Date.now()), 0);
+    return () => window.clearTimeout(timeout);
+  }, []);
+
   useEffect(() => {
     try { window.localStorage.setItem("orbit-theme", theme); } catch { /* Optional preference only. */ }
   }, [theme]);
@@ -1,1 +1,1 @@
-  const staleCount = profile.repositories.filter((repo) => !repo.isArchived && (Date.now() - new Date(repo.pushedAt ?? repo.updatedAt).getTime()) > 180 * 86_400_000).length;
+  const staleCount = currentTime === null ? 0 : profile.repositories.filter((repo) => !repo.isArchived && (currentTime - new Date(repo.pushedAt ?? repo.updatedAt).getTime()) > 180 * 86_400_000).length;
