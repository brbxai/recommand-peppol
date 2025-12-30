export const MESSAGE_LEVEL_RESPONSE_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charSet="utf-8" />
    <title>{{documentTypeLabel}} {{responseId}}</title>
    <style>
      /* Tailwind preflight is injected by the Tailwind PDF generator */
      body { margin: 0; padding: 0; }
    </style>
  </head>
  <body class="bg-slate-100 text-slate-900">
    <div class="max-w-3xl mx-auto my-8 bg-white shadow-sm rounded-lg overflow-hidden">
      <div class="px-8 pt-8 pb-4 border-b border-slate-200">
        <div class="flex items-start justify-between gap-4">
          <div>
            <p class="text-xs font-semibold tracking-wide uppercase text-slate-500">
              {{documentTypeLabel}}
            </p>
            <h1 class="mt-1 text-2xl font-semibold tracking-tight">
              {{responseId}}
            </h1>
            <p class="mt-2 text-xs text-slate-500 space-x-2">
              <span>Issue date: {{issueDate}}</span>
            </p>
          </div>
        </div>
      </div>

      <div class="px-8 py-6 space-y-6">
        <div>
          <p class="text-xs font-semibold tracking-wide uppercase text-slate-500 mb-2">Response Code</p>
          <div class="flex items-center gap-3">
            <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium
              {{#isAccepted}}bg-green-100 text-green-800{{/isAccepted}}
              {{#isRejected}}bg-red-100 text-red-800{{/isRejected}}
              {{#isAcknowledgement}}bg-blue-100 text-blue-800{{/isAcknowledgement}}">
              {{responseCode}}
            </span>
            <span class="text-sm text-slate-700">{{responseCodeLabel}}</span>
          </div>
        </div>

        <div>
          <p class="text-xs font-semibold tracking-wide uppercase text-slate-500 mb-2">Envelope ID</p>
          <p class="text-sm text-slate-700 font-mono break-all">{{envelopeId}}</p>
          <p class="text-xs text-slate-500 mt-1">The document this response refers to</p>
        </div>
      </div>
    </div>
  </body>
</html>`;

