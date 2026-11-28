import { Redirect } from "expo-router";

// The root account provider handles the code exchange through WebBrowser.
export default function AuthCallback() {
  return <Redirect href="/rights" />;
}
