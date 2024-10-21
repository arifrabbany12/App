import { json } from "@remix-run/node";
import { useFetcher } from "@remix-run/react";
import {
  Page,
  Layout,
  Text,
  Card,
  Button,
  BlockStack,
  InlineStack,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";

// Loader to authenticate the admin
export const loader = async ({ request }) => {
  await authenticate.admin(request);
  return null;
};

// Function to fetch the current theme ID
const fetchCurrentThemeId = async (admin) => {
  try {
    const response = await admin.graphql(
      `#graphql
        query {
          themes(first: 10) {
            edges {
              node {
                id
                name
                role
              }
            }
          }
        }`
    );

    const data = await response.json();
    
    // Log the response for debugging
    console.log("Themes Query Response:", data);

    if (!data || !data.data || !data.data.themes) {
      console.error("No themes data found in the response.");
      return null;
    }

    // Extract the active theme
    const activeTheme = data.data.themes.edges.find(theme => theme.node.role === 'main');
    
    if (!activeTheme) {
      console.error("No active theme found.");
      return null;
    }

    return activeTheme.node.id; // Return the theme ID
  } catch (error) {
    console.error("Error fetching current theme ID:", error);
    return null;
  }
};

// Action that handles adding the section to the theme
export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const sectionName = `Simple Template ${Date.now()}`;

  // Get the current theme ID
  const themeId = await fetchCurrentThemeId(admin);

  if (!themeId) {
    return json({
      error: "No active theme found. Please ensure your theme is active and has the role 'main'."
    }, { status: 400 });
  }

  // Liquid code for the section
  const liquidCode = `
  <!-- sections/${sectionName.toLowerCase().replace(/\s+/g, '-')}.liquid -->
  <div class="simple-template">
    <h2>Simple Template Section</h2>
    <p>This is a simple template added to your theme!</p>
    <style>
      .simple-template {
        padding: 20px;
        background-color: #f9f9f9;
        border: 1px solid #ddd;
        border-radius: 5px;
      }
      .simple-template h2 {
        color: #333;
      }
      .simple-template p {
        color: #666;
      }
    </style>
  </div>

  {% schema %}
  {
    "name": "Simple Template",
    "settings": [],
    "presets": [
      {
        "name": "Simple Template",
        "category": "Custom"
      }
    ]
  }
  {% endschema %}
  `;

  // Create the section file in the theme
  const mutationResponse = await admin.graphql(
    `#graphql
      mutation addSectionToTheme($input: ThemeFileInput!) {
        themeFileCreate(input: $input) {
          userErrors {
            field
            message
          }
        }
      }`,
    {
      variables: {
        input: {
          key: `sections/${sectionName.toLowerCase().replace(/\s+/g, '-')}.liquid`,
          value: liquidCode,
          themeId: themeId,
        },
      },
    }
  );

  const responseJson = await mutationResponse.json();

  // Check for user errors
  if (responseJson.data.themeFileCreate.userErrors.length > 0) {
    console.error("GraphQL Errors:", responseJson.data.themeFileCreate.userErrors);
    return json({
      error: "Failed to create section",
      details: responseJson.data.themeFileCreate.userErrors,
    }, { status: 400 });
  }

  return json({ message: "Section added successfully!" });
};

// The component to render the page
export default function AddSectionPage() {
  const fetcher = useFetcher();
  const isLoading = ["loading", "submitting"].includes(fetcher.state) && fetcher.formMethod === "POST";

  const addSection = () => {
    fetcher.submit({}, { method: "POST" });
  };

  return (
    <Page>
      <TitleBar title="Add Simple Template Section" />
      <BlockStack gap="500">
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="500">
                <BlockStack gap="200">
                  <Text as="h2" variant="headingMd">
                    Add a New Simple Template Section 🎉
                  </Text>
                  <Text variant="bodyMd" as="p">
                    Click the button below to add a simple template section to your theme.
                  </Text>
                </BlockStack>
                <InlineStack gap="300">
                  <Button loading={isLoading} onClick={addSection} primary>
                    Add Section
                  </Button>
                </InlineStack>
                {fetcher.data && fetcher.data.message && (
                  <>
                    <Text as="h3" variant="headingMd">
                      {fetcher.data.message}
                    </Text>
                  </>
                )}
                {fetcher.data && fetcher.data.error && (
                  <>
                    <Text as="h3" variant="headingMd" color="critical">
                      {fetcher.data.error}
                    </Text>
                  </>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
