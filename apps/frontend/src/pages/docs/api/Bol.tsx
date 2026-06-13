import DocsPage from '../../../components/docs/DocsPage';
import { H2, P, Code, CodeBlock, Callout, DocsTable, UL } from '../../../components/docs/DocsPrimitives';

export default function ApiBol() {
  return (
    <DocsPage
      section="Modules"
      title="BOL Processor"
      plainEnglish={
        <>
          <p>
            A bill of lading (BOL) is the document that accompanies a shipment — it lists what&rsquo;s being shipped,
            where it&rsquo;s going, who&rsquo;s carrying it, and at what weight and value. BOL Processor takes that raw
            document and turns it into a clean, structured record across all three logistics modes —{' '}
            <strong>Truck BOL</strong>, <strong>Air Waybill (AWB)</strong>, and{' '}
            <strong>Ocean BOL (OBL / MBL / HBL)</strong>. Along the way it checks for compliance issues — missing
            customs data, restricted goods, unverified parties, invalid port codes — and raises flags before the
            shipment moves.
          </p>
          <p>
            Pass <Code>bolType</Code> to select the mode. Existing integrations default to <Code>'TRUCK_BOL'</Code> —
            no changes required to keep working exactly as before.
          </p>
        </>
      }
    >
      <H2>Overview</H2>
      <Callout>
        Namespace: <Code>progue.bol</Code> · Module: <Code>BOL_PROCESSING</Code> · External APIs: none ·{' '}
        <strong>[LIVE]</strong>
      </Callout>
      <P>
        Turn a raw bill of lading into a validated, structured record, and raise compliance flags before the shipment
        moves — across Truck BOL, Air Waybill, and Ocean BOL. Every tool accepts the same <Code>bolType</Code>{' '}
        parameter, so one integration pattern covers all three document types.
      </P>
      <DocsTable
        head={['bolType value', 'Document type', 'Notes']}
        rows={[
          [<Code>TRUCK_BOL</Code>, 'Truck bill of lading', 'Default — omit the parameter to keep existing behavior'],
          [
            <Code>AIR_WAYBILL</Code>,
            'Air waybill (AWB / MAWB / HAWB)',
            'House AWB fields are populated only for consolidated shipments',
          ],
          [
            <Code>OCEAN_BOL</Code>,
            'Ocean bill of lading (OBL / MBL / HBL)',
            'Includes container, port, and customs-broker fields',
          ],
        ]}
      />

      <H2>
        The <Code>bolType</Code> parameter
      </H2>
      <P>
        <Code>extract_bol_fields</Code>, <Code>validate_bol_data</Code>, and <Code>flag_bol_discrepancies</Code> all
        accept an optional <Code>bolType</Code> parameter — <Code>'TRUCK_BOL'</Code>, <Code>'AIR_WAYBILL'</Code>, or{' '}
        <Code>'OCEAN_BOL'</Code>. It determines which fields are extracted, which validation rules run, and which
        compliance flags can fire. When you omit it, it defaults to <Code>'TRUCK_BOL'</Code> — so existing Truck BOL
        integrations keep working without any changes.
      </P>

      <H2>Truck BOL</H2>
      <P>
        The default mode — pass <Code>bolType: 'TRUCK_BOL'</Code>, or omit the parameter entirely for
        backward-compatible behavior. Extraction returns shipper, consignee, and carrier details; validation checks
        SCAC and PRO number formats and flags missing delivery addresses.
      </P>
      <CodeBlock language="ts">{`// 1. Extract — bolType defaults to 'TRUCK_BOL', so it can be omitted
const bol = await progue.bol.extract_bol_fields({
  rawText: '<raw BOL text>',
});
// → { bolNumber, shipperName, consigneeName, originPort, destinationPort,
//     carrierName, grossWeightKg, packageCount, freightTerms, … }

// 2. Validate
const validation = await progue.bol.validate_bol_data({ bolFields: bol });
// → { isValid, errors[], missingRequiredFields[],
//     complianceFlags: [...] }   // MISSING_SCAC, INVALID_PRO_NUMBER, MISSING_DELIVERY_ADDRESS

// 3. Compare against the purchase order
const result = await progue.bol.flag_bol_discrepancies({
  bolFields: bol,
  referenceDoc: purchaseOrder,
  referenceType: 'PURCHASE_ORDER',
});
// → { hasDiscrepancies, discrepancies[], recommendedAction, summary }`}</CodeBlock>

      <H2>Air Waybill</H2>
      <P>
        Pass <Code>bolType: 'AIR_WAYBILL'</Code> for air freight. Extraction returns AWB-specific fields — airline,
        airports, weights, and special-handling codes — and validation runs IATA format checks plus air-specific
        compliance flags.
      </P>
      <CodeBlock language="ts">{`// 1. Extract
const awb = await progue.bol.extract_bol_fields({
  rawText: '<raw AWB text>',
  bolType: 'AIR_WAYBILL',
});
// → { awbNumber, airlineCode, originAirport, destinationAirport, pieces,
//     grossWeightKg, chargeableWeightKg, commodity, freightCharges, … }

// 2. Validate — compliance flags are computed by deterministic logic, not the model
const validation = await progue.bol.validate_bol_data({
  bolFields: awb,
  bolType: 'AIR_WAYBILL',
});
// → { isValid, errors[], missingRequiredFields[],
//     complianceFlags: [
//       { code: 'DANGEROUS_GOODS_UNDECLARED', severity: 'critical',
//         message: 'Commodity indicates dangerous goods but DGR is absent from specialHandling',
//         field: 'specialHandling' },
//     ] }

// 3. Compare against the shipment record
const result = await progue.bol.flag_bol_discrepancies({
  bolFields: awb,
  referenceDoc: shipmentRecord,
  referenceType: 'SHIPMENT_RECORD',
  bolType: 'AIR_WAYBILL',
});
// → { hasDiscrepancies, discrepancies[], recommendedAction, summary }`}</CodeBlock>

      <H2>Ocean BOL</H2>
      <P>
        Pass <Code>bolType: 'OCEAN_BOL'</Code> for ocean freight. Extraction returns vessel, voyage, container, and
        customs-broker details; validation checks port codes, container number formats (ISO 6346), and House/Master
        BOL consistency.
      </P>
      <CodeBlock language="ts">{`// 1. Extract
const obl = await progue.bol.extract_bol_fields({
  rawText: '<raw Ocean BOL text>',
  bolType: 'OCEAN_BOL',
});
// → { vesselName, voyageNumber, portOfLoading, portOfDischarge,
//     containers: [{ containerNumber, sealNumber, type, weightKg, cbm }],
//     commodity, freightTerms, customsBroker, … }

// 2. Validate
const validation = await progue.bol.validate_bol_data({
  bolFields: obl,
  bolType: 'OCEAN_BOL',
});
// → { isValid, errors[], missingRequiredFields[],
//     complianceFlags: [
//       { code: 'CUSTOMS_BROKER_UNVERIFIED', severity: 'critical',
//         message: 'customsBroker.verified is false', field: 'customsBroker' },
//     ] }

// 3. Compare against the shipment record
const result = await progue.bol.flag_bol_discrepancies({
  bolFields: obl,
  referenceDoc: shipmentRecord,
  referenceType: 'SHIPMENT_RECORD',
  bolType: 'OCEAN_BOL',
});
// → { hasDiscrepancies, discrepancies[], recommendedAction, summary }`}</CodeBlock>

      <H2>Compliance flag codes</H2>
      <P>
        Compliance flags are computed by deterministic logic — not inferred by the model — and returned in{' '}
        <Code>validate_bol_data</Code>&rsquo;s <Code>complianceFlags</Code> array.
      </P>
      <DocsTable
        head={['Flag code', 'Applies to', 'Severity', 'Description']}
        rows={[
          [<Code>MISSING_SCAC</Code>, 'TRUCK_BOL', 'warning', 'SCAC code absent or not 2–4 uppercase letters'],
          [<Code>INVALID_PRO_NUMBER</Code>, 'TRUCK_BOL', 'warning', 'PRO number is not 5–10 digits'],
          [<Code>MISSING_DELIVERY_ADDRESS</Code>, 'TRUCK_BOL', 'warning', 'Consignee address is absent'],
          [
            <Code>INVALID_AWB_NUMBER</Code>,
            'AIR_WAYBILL',
            'critical',
            <>
              AWB number is not in <Code>XXX-XXXXXXXX</Code> IATA format
            </>,
          ],
          [
            <Code>INVALID_AIRPORT_CODE</Code>,
            'AIR_WAYBILL',
            'warning',
            'Origin or destination is not a 3-letter uppercase IATA code',
          ],
          [
            <Code>MISSING_HAWB</Code>,
            'AIR_WAYBILL',
            'warning',
            <>
              A Master AWB number (<Code>mawbNumber</Code>) is present but the house AWB number (
              <Code>hawbNumber</Code>) is missing
            </>,
          ],
          [
            <Code>DANGEROUS_GOODS_UNDECLARED</Code>,
            'AIR_WAYBILL',
            'critical',
            <>
              Commodity text suggests dangerous goods (battery, lithium, flammable, aerosol, …) but{' '}
              <Code>DGR</Code> is absent from <Code>specialHandling</Code>
            </>,
          ],
          [
            <Code>WEIGHT_DISCREPANCY</Code>,
            'AIR_WAYBILL',
            'warning',
            <>
              <Code>chargeableWeightKg</Code> exceeds <Code>grossWeightKg × 1.1</Code>
            </>,
          ],
          [
            <Code>MISSING_CONTAINER_NUMBERS</Code>,
            'OCEAN_BOL',
            'critical',
            <>
              The <Code>containers</Code> array is empty
            </>,
          ],
          [
            <Code>CONTAINER_FORMAT_INVALID</Code>,
            'OCEAN_BOL',
            'warning',
            'Container number fails ISO 6346 format (4 letters + 7 digits)',
          ],
          [
            <Code>MISSING_PORT_CODES</Code>,
            'OCEAN_BOL',
            'critical',
            <>
              <Code>portOfLoading</Code> or <Code>portOfDischarge</Code> is absent or not a valid UN/LOCODE
            </>,
          ],
          [
            <Code>HBL_WITHOUT_MBL</Code>,
            'OCEAN_BOL',
            'warning',
            'A House BOL number is present but the Master BOL number is absent',
          ],
          [
            <Code>CUSTOMS_BROKER_UNVERIFIED</Code>,
            'OCEAN_BOL',
            'critical',
            <>
              <Code>customsBroker</Code> is present but <Code>customsBroker.verified</Code> is <Code>false</Code>
            </>,
          ],
        ]}
      />

      <H2>Typical flow</H2>
      <P>
        The same three-step pipeline applies to every mode — only the <Code>bolType</Code> changes:
      </P>
      <UL
        items={[
          <>
            <strong>Truck:</strong> <Code>extract_bol_fields</Code> (<Code>TRUCK_BOL</Code>) →{' '}
            <Code>validate_bol_data</Code> → <Code>flag_bol_discrepancies</Code>, then hand clean line items to{' '}
            <Code>hts.classify</Code>
          </>,
          <>
            <strong>Air:</strong> <Code>extract_bol_fields</Code> (<Code>AIR_WAYBILL</Code>) →{' '}
            <Code>validate_bol_data</Code> → <Code>flag_bol_discrepancies</Code>, then hand clean line items to{' '}
            <Code>hts.classify</Code>
          </>,
          <>
            <strong>Ocean:</strong> <Code>extract_bol_fields</Code> (<Code>OCEAN_BOL</Code>) →{' '}
            <Code>validate_bol_data</Code> → <Code>flag_bol_discrepancies</Code>, then hand clean line items to{' '}
            <Code>hts.classify</Code>
          </>,
        ]}
      />
    </DocsPage>
  );
}

