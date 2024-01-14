export const kustoData = {
  'Sales Forecasting':
    "cluster('crmanacus.kusto.windows.net').database('CRMProdCloudServices').SFTraceEvent | union cluster('crmanaweu.kusto.windows.net').database('CRMProdCloudServices').SFTraceEvent | where TIMESTAMP > ago(1d) | where ActivityId == $(Guid) or  OrgId == $(Guid)",
  'Notes Analysis':
    "cluster('crmanacus.kusto.windows.net').database('CRMProdCloudServices').SFTraceEvent | union cluster('crmanaweu.kusto.windows.net').database('CRMProdCloudServices').SFTraceEvent | where TIMESTAMP > ago(1d) | where ActivityId == $(Guid) or  OrgId == $(Guid)",
}