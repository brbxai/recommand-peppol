![Recommand Peppol Banner](./readme-banner.png)

# Recommand Peppol API

**The open source Peppol API you'll actually enjoy using.**

RESTful, well-documented, and open-source. Connect your app to Peppol in minutes and stay in control of your invoicing.


## Features

- **User-Friendly REST API**: Integrate Peppol into your software in minutes with clear documentation and intuitive design.
- **Intuitive Dashboard**: Track sent/received invoices, manage API keys, and view billing info in a simple dashboard.
- **Secure Document Handling**: Encryption and digital signatures for UBL invoices, credit notes, and more.
- **Certified Peppol Provider**: Official, secure Peppol connection for sending and receiving e-invoices and other documents.
- **Open Source Implementation**: Full transparency and flexibility—see how your data is processed.
- **Transparent Pricing**: Clear, volume-based pricing with no hidden costs or lock-in.


## Main API Endpoints

- `POST /api/peppol/{companyId}/sendDocument` — Send invoices and documents via Peppol
- `GET /api/peppol/{teamId}/documents` — List all sent and received documents
- `GET /api/peppol/{teamId}/inbox` — Access unread incoming documents
- `POST /api/peppol/verify` — Verify if a recipient is registered in the network

## Documentation

- [Getting Started Guide](https://recommand.eu/docs/getting-started)
- [API Reference](https://peppol.recommand.eu/api-reference)
- [How-To Guides](https://recommand.eu/docs)

## Pricing
The Recommand Peppol API is freely available as open source software.
When using our hosted API, we have different pricing tiers available.
See [our pricing page](https://recommand.eu/en/pricing) for more info.

## Community & Support

- [GitHub](https://github.com/brbxai/recommand-peppol)
- [Discord](https://discord.gg/a2tcQYA3ew)
- [Contact](https://recommand.eu/contact) or email us at [support@recommand.eu](mailto:support@recommand.eu)

## License
This project is licensed under the AGPL-3.0 license. However, when using our hosted API service, you are subject to our terms of service instead of the AGPL-3.0 license.