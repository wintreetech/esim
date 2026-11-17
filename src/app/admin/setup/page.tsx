import { requireAdminPage } from "@/lib/auth";
import { checkoutSetupIssues } from "@/lib/payments/config";
import { authSettings } from "@/lib/auth-config";
import { release } from "@/lib/release";
export default async function Setup() {
  await requireAdminPage();
  const issues = checkoutSetupIssues();
  return (
    <>
      <h1>Store setup</h1>
      <p>
        Release {release}. Settings shown here are private to administrators.
      </p>
      <div className="panel">
        <h2>Checkout readiness</h2>
        {issues.length ? (
          <ul>
            {issues.map((issue) => (
              <li key={issue.code} style={{ marginBlock: 14 }}>
                {issue.message}
              </li>
            ))}
          </ul>
        ) : (
          <p>
            Environment checks passed. Verify merchant authentication, public
            callbacks and email delivery before accepting customers.
          </p>
        )}
      </div>
      <div className="panel" style={{ marginTop: 24 }}>
        <h2>Customer accounts</h2>
        <p>
          {authSettings()
            ? "Supabase account settings are present. Confirm the allowed callback URLs and email delivery in Supabase."
            : "Supabase sign-in settings are missing or invalid. Configure the project URL and publishable key in this deployment."}
        </p>
      </div>
    </>
  );
}
