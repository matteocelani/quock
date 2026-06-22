// Entry route — redirects to /c (authed) or /login; spinner is a fallback while the native splash is still up.

import { Redirect } from "expo-router";
import React from "react";
import { View } from "react-native";
import { Spinner } from "@/components/ui/Spinner";
import { timingsNamed } from "@/lib/design/tokens";
import { useAuthContext } from "@/modules/auth/context/AuthContext";

export default function Index(): React.ReactElement {
  const { status } = useAuthContext();
  const [shouldShowSpinner, setShouldShowSpinner] = React.useState(false);
  React.useEffect(() => {
    if (status !== "checking") {
      setShouldShowSpinner(false);
      return;
    }
    const timer = setTimeout(() => {
      setShouldShowSpinner(true);
    }, timingsNamed.routeSpinnerDefer);
    return () => clearTimeout(timer);
  }, [status]);
  if (status === "checking") {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        {shouldShowSpinner ? <Spinner /> : null}
      </View>
    );
  }
  if (status === "authenticated") {
    return <Redirect href="/c" />;
  }
  return <Redirect href="/login" />;
}
