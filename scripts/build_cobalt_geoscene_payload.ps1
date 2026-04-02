$ErrorActionPreference = "Stop"

Set-StrictMode -Version Latest

$repoRoot = Split-Path -Parent $PSScriptRoot
$outputPath = Join-Path $repoRoot "assets\cobalt_geoscene_data.js"

function Split-List {
  param([string]$Value)

  if ([string]::IsNullOrWhiteSpace($Value)) {
    return @()
  }

  return @(
    $Value -split "\s*;\s*" |
      Where-Object { -not [string]::IsNullOrWhiteSpace($_) } |
      ForEach-Object { $_.Trim() }
  )
}

function To-NullableDouble {
  param([string]$Value)

  if ([string]::IsNullOrWhiteSpace($Value)) {
    return $null
  }

  return [double]::Parse($Value, [System.Globalization.CultureInfo]::InvariantCulture)
}

function Has-AnyValue {
  param([Parameter(ValueFromRemainingArguments = $true)][object[]]$Values)

  foreach ($value in $Values) {
    if ($null -eq $value) {
      continue
    }

    if ($value -is [string]) {
      if (-not [string]::IsNullOrWhiteSpace($value)) {
        return $true
      }
      continue
    }

    return $true
  }

  return $false
}

function Get-TransactionKey {
  param($Relationship)

  if (-not [string]::IsNullOrWhiteSpace($Relationship.transaction_id)) {
    return $Relationship.transaction_id.Trim()
  }

  if ($Relationship.start_id -like "transaction::*") {
    return $Relationship.start_id.Substring("transaction::".Length)
  }

  if ($Relationship.end_id -like "transaction::*") {
    return $Relationship.end_id.Substring("transaction::".Length)
  }

  return $null
}

function Get-FirstRelationship {
  param(
    [object[]]$Rows,
    [string]$Type
  )

  return $Rows | Where-Object { $_.type -eq $Type } | Select-Object -First 1
}

function Add-UniqueListItems {
  param(
    [System.Collections.Generic.List[string]]$Target,
    [string[]]$Values
  )

  foreach ($value in $Values) {
    if ([string]::IsNullOrWhiteSpace($value)) {
      continue
    }

    if (-not $Target.Contains($value)) {
      $Target.Add($value)
    }
  }
}

function Resolve-Point {
  param(
    $Facility,
    $Company,
    [hashtable]$CountriesByName
  )

  if ($Facility -and $null -ne $Facility.lat -and $null -ne $Facility.lon) {
    return [ordered]@{
      lat = $Facility.lat
      lon = $Facility.lon
      source = "facility"
      label = $Facility.searchLabel
    }
  }

  if ($Company -and $null -ne $Company.lat -and $null -ne $Company.lon) {
    return [ordered]@{
      lat = $Company.lat
      lon = $Company.lon
      source = "company"
      label = $Company.name
    }
  }

  $countryName = $null
  if ($Facility) {
    $countryName = $Facility.country
  }
  if ([string]::IsNullOrWhiteSpace($countryName) -and $Company) {
    $countryName = $Company.country
  }

  if (-not [string]::IsNullOrWhiteSpace($countryName) -and $CountriesByName.ContainsKey($countryName)) {
    $country = $CountriesByName[$countryName]
    if ($null -ne $country.lat -and $null -ne $country.lon) {
      return [ordered]@{
        lat = $country.lat
        lon = $country.lon
        source = "country"
        label = $country.name
      }
    }
  }

  return $null
}

$companiesById = @{}
$facilitiesById = @{}
$commoditiesById = @{}
$sourcesById = @{}
$countriesByName = @{}

$companies = Import-Csv (Join-Path $repoRoot "companies.csv")
$facilities = Import-Csv (Join-Path $repoRoot "facilities.csv")
$commodities = Import-Csv (Join-Path $repoRoot "commodities.csv")
$countries = Import-Csv (Join-Path $repoRoot "countries.csv")
$transactions = Import-Csv (Join-Path $repoRoot "transactions.csv")
$relationships = Import-Csv (Join-Path $repoRoot "relationships.csv")
$sources = Import-Csv (Join-Path $repoRoot "sources.csv")
$summary = Get-Content (Join-Path $repoRoot "summary.json") -Raw | ConvertFrom-Json

foreach ($row in $countries) {
  $entry = [ordered]@{
    id = $row.node_id
    name = $row.name
    centroidName = $row.centroid_name
    lat = To-NullableDouble $row.lat
    lon = To-NullableDouble $row.lon
  }
  $countriesByName[$row.name] = $entry
}

foreach ($row in $companies) {
  $entry = [ordered]@{
    id = $row.node_id
    type = "company"
    name = $row.name
    searchLabel = $row.name
    country = $row.country_name
    lat = To-NullableDouble $row.lat
    lon = To-NullableDouble $row.lon
    roleTags = Split-List $row.role_tags
    companyTypeTags = Split-List $row.company_type_tags
    locationPrecision = $row.location_precision
    sourceRef = $row.bhrrc_link
  }
  $companiesById[$row.node_id] = $entry
}

foreach ($row in $facilities) {
  $labelParts = New-Object "System.Collections.Generic.List[string]"
  if (-not [string]::IsNullOrWhiteSpace($row.display_name)) { $labelParts.Add($row.display_name.Trim()) }
  if (-not [string]::IsNullOrWhiteSpace($row.country_name)) { $labelParts.Add($row.country_name.Trim()) }
  if (-not [string]::IsNullOrWhiteSpace($row.place)) { $labelParts.Add($row.place.Trim()) }
  $searchLabel = [string]::Join(" | ", $labelParts)

  $entry = [ordered]@{
    id = $row.node_id
    type = "facility"
    name = $row.name
    displayName = $row.display_name
    searchLabel = $searchLabel
    country = $row.country_name
    facilityType = $row.facility_type
    lat = To-NullableDouble $row.lat
    lon = To-NullableDouble $row.lon
    place = $row.place
  }
  $facilitiesById[$row.node_id] = $entry
}

foreach ($row in $commodities) {
  $entry = [ordered]@{
    id = $row.node_id
    name = $row.name
    commodityTypes = Split-List $row.commodity_types
    directionTags = Split-List $row.direction_tags
  }
  $commoditiesById[$row.node_id] = $entry
}

foreach ($row in $sources) {
  $entry = [ordered]@{
    id = $row.node_id
    url = $row.url
    host = $row.host
  }
  $sourcesById[$row.node_id] = $entry
}

$transactionRelationships = @{}
$operatorPairs = New-Object "System.Collections.Generic.List[object]"

foreach ($relationship in $relationships) {
  if ($relationship.type -eq "OPERATES_FACILITY") {
    $operatorPairs.Add([ordered]@{
      companyId = $relationship.start_id
      facilityId = $relationship.end_id
      side = $relationship.side
    })
  }

  $txKey = Get-TransactionKey $relationship
  if ([string]::IsNullOrWhiteSpace($txKey)) {
    continue
  }

  if (-not $transactionRelationships.ContainsKey($txKey)) {
    $transactionRelationships[$txKey] = New-Object System.Collections.Generic.List[object]
  }

  $transactionRelationships[$txKey].Add($relationship)
}

$stageOrder = @(
  "Artisanal mining",
  "Mining",
  "Artisanal processing",
  "Smelting",
  "Refining",
  "Trading",
  "Precursor manufacturing",
  "Cathode manufacturing",
  "Battery cell manufacturing",
  "Battery pack manufacturing",
  "Electric car manufacturing",
  "Electric scooter manufacturing",
  "Recycling"
)

$stageColors = [ordered]@{
  "Artisanal mining" = "#53b7ff"
  "Mining" = "#3de2d8"
  "Artisanal processing" = "#50f09c"
  "Smelting" = "#8fff68"
  "Refining" = "#d6ff56"
  "Trading" = "#ffd85a"
  "Precursor manufacturing" = "#ffae57"
  "Cathode manufacturing" = "#ff7d7d"
  "Battery cell manufacturing" = "#ff64c8"
  "Battery pack manufacturing" = "#d18bff"
  "Electric car manufacturing" = "#7ab6ff"
  "Electric scooter manufacturing" = "#4fb0ff"
  "Recycling" = "#52e6bf"
}

$transactionPayload = New-Object "System.Collections.Generic.List[object]"
$quantityRecords = 0
$dateRecords = 0
$sourceBackedRecords = 0
$commodityBackedRecords = 0

foreach ($transaction in $transactions) {
  $txId = $transaction.transaction_id
  if ([string]::IsNullOrWhiteSpace($txId)) {
    continue
  }

  $rels = @()
  if ($transactionRelationships.ContainsKey($txId)) {
    $rels = @($transactionRelationships[$txId])
  }

  $supplierLink = Get-FirstRelationship $rels "SUPPLIER_IN"
  $buyerLink = Get-FirstRelationship $rels "BUYER_IN"
  $supplierFacilityLink = Get-FirstRelationship $rels "SUPPLIER_FACILITY"
  $buyerFacilityLink = Get-FirstRelationship $rels "BUYER_FACILITY"
  $inputStageLink = Get-FirstRelationship $rels "INPUT_CHAIN_STEP"
  $outputStageLink = Get-FirstRelationship $rels "OUTPUT_CHAIN_STEP"
  $chainLink = Get-FirstRelationship $rels "CHAIN_LINK"
  $supplyLink = Get-FirstRelationship $rels "SUPPLIES_TO"

  $supplierCompanyId = if ($supplierLink) { $supplierLink.start_id } elseif ($supplyLink) { $supplyLink.start_id } else { $null }
  $buyerCompanyId = if ($buyerLink) { $buyerLink.start_id } elseif ($supplyLink) { $supplyLink.end_id } else { $null }
  $supplierFacilityId = if ($supplierFacilityLink) { $supplierFacilityLink.end_id } else { $null }
  $buyerFacilityId = if ($buyerFacilityLink) { $buyerFacilityLink.end_id } else { $null }

  $supplierCompany = if ($supplierCompanyId -and $companiesById.ContainsKey($supplierCompanyId)) { $companiesById[$supplierCompanyId] } else { $null }
  $buyerCompany = if ($buyerCompanyId -and $companiesById.ContainsKey($buyerCompanyId)) { $companiesById[$buyerCompanyId] } else { $null }
  $supplierFacility = if ($supplierFacilityId -and $facilitiesById.ContainsKey($supplierFacilityId)) { $facilitiesById[$supplierFacilityId] } else { $null }
  $buyerFacility = if ($buyerFacilityId -and $facilitiesById.ContainsKey($buyerFacilityId)) { $facilitiesById[$buyerFacilityId] } else { $null }

  $inputCommodityIds = @(
    $rels |
      Where-Object { $_.type -eq "INPUT_COMMODITY" } |
      ForEach-Object { $_.end_id } |
      Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
  )
  $outputCommodityIds = @(
    $rels |
      Where-Object { $_.type -eq "OUTPUT_COMMODITY" } |
      ForEach-Object { $_.end_id } |
      Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
  )
  $sourceIds = @(
    $rels |
      Where-Object { $_.type -eq "SUPPORTED_BY" } |
      ForEach-Object { $_.end_id } |
      Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
  )

  $inputCommodities = @(
    foreach ($commodityId in $inputCommodityIds) {
      if ($commoditiesById.ContainsKey($commodityId)) {
        $commoditiesById[$commodityId].name
      }
    }
  )
  $outputCommodities = @(
    foreach ($commodityId in $outputCommodityIds) {
      if ($commoditiesById.ContainsKey($commodityId)) {
        $commoditiesById[$commodityId].name
      }
    }
  )

  $supplierStage = $null
  if ($inputStageLink -and $inputStageLink.end_id -like "chain_step::*") {
    $supplierStage = $inputStageLink.end_id.Substring("chain_step::".Length).Replace("-", " ")
    $supplierStage = (Get-Culture).TextInfo.ToTitleCase($supplierStage.ToLowerInvariant())
  }

  $buyerStage = $null
  if ($outputStageLink -and $outputStageLink.end_id -like "chain_step::*") {
    $buyerStage = $outputStageLink.end_id.Substring("chain_step::".Length).Replace("-", " ")
    $buyerStage = (Get-Culture).TextInfo.ToTitleCase($buyerStage.ToLowerInvariant())
  }

  $sourcePoint = Resolve-Point $supplierFacility $supplierCompany $countriesByName
  $targetPoint = Resolve-Point $buyerFacility $buyerCompany $countriesByName
  if (-not $sourcePoint -or -not $targetPoint) {
    continue
  }

  $noteParts = New-Object "System.Collections.Generic.List[string]"
  foreach ($field in @($transaction.notes, $transaction.notes1, $transaction.transaction_notes)) {
    if (-not [string]::IsNullOrWhiteSpace($field)) {
      $noteParts.Add($field.Trim())
    }
  }

  $hasQuantity = Has-AnyValue `
    $transaction.amount_tonnes_raw `
    $transaction.amount_tonnes_value `
    $transaction.amount_units_raw `
    $transaction.amount_units_value `
    $transaction.amount_usd_raw `
    $transaction.amount_usd_value `
    $transaction.amount_yuan_raw `
    $transaction.amount_yuan_value `
    $transaction.amount_energy_units_raw `
    $transaction.amount_energy_units_value
  if ($hasQuantity) { $quantityRecords++ }

  $hasDate = Has-AnyValue $transaction.date_of_transaction $transaction.expected_date_of_transaction
  if ($hasDate) { $dateRecords++ }

  $hasSources = $sourceIds.Count -gt 0
  if ($hasSources) { $sourceBackedRecords++ }

  $hasCommodity = $inputCommodityIds.Count -gt 0 -or $outputCommodityIds.Count -gt 0
  if ($hasCommodity) { $commodityBackedRecords++ }

  $transactionPayload.Add([ordered]@{
    id = $txId
    nodeId = $transaction.node_id
    supplierCompanyId = $supplierCompanyId
    supplierCompany = if ($supplierCompany) { $supplierCompany.name } else { $null }
    buyerCompanyId = $buyerCompanyId
    buyerCompany = if ($buyerCompany) { $buyerCompany.name } else { $null }
    supplierFacilityId = $supplierFacilityId
    supplierFacility = if ($supplierFacility) { $supplierFacility.searchLabel } else { $null }
    buyerFacilityId = $buyerFacilityId
    buyerFacility = if ($buyerFacility) { $buyerFacility.searchLabel } else { $null }
    supplierCountry = if ($supplierFacility) { $supplierFacility.country } elseif ($supplierCompany) { $supplierCompany.country } else { $null }
    buyerCountry = if ($buyerFacility) { $buyerFacility.country } elseif ($buyerCompany) { $buyerCompany.country } else { $null }
    supplierStage = $supplierStage
    buyerStage = $buyerStage
    chainLink = if ($transaction.link_in_chain) { $transaction.link_in_chain } elseif ($supplyLink) { $supplyLink.link_in_chain } else { $null }
    chainLinkId = if ($chainLink) { $chainLink.end_id } else { $null }
    inputCommodityIds = $inputCommodityIds
    inputCommodities = $inputCommodities
    outputCommodityIds = $outputCommodityIds
    outputCommodities = $outputCommodities
    sourceIds = $sourceIds
    sourceCount = $sourceIds.Count
    amountTonnesRaw = $transaction.amount_tonnes_raw
    amountTonnesValue = if ($transaction.amount_tonnes_value) { [double]$transaction.amount_tonnes_value } else { $null }
    amountUnitsRaw = $transaction.amount_units_raw
    amountUnitsValue = if ($transaction.amount_units_value) { [double]$transaction.amount_units_value } else { $null }
    amountUsdRaw = $transaction.amount_usd_raw
    amountUsdValue = if ($transaction.amount_usd_value) { [double]$transaction.amount_usd_value } else { $null }
    amountYuanRaw = $transaction.amount_yuan_raw
    amountYuanValue = if ($transaction.amount_yuan_value) { [double]$transaction.amount_yuan_value } else { $null }
    amountEnergyRaw = $transaction.amount_energy_units_raw
    amountEnergyValue = if ($transaction.amount_energy_units_value) { [double]$transaction.amount_energy_units_value } else { $null }
    date = $transaction.date_of_transaction
    expectedDate = $transaction.expected_date_of_transaction
    realised = $transaction.transaction_realised
    notes = @($noteParts)
    hasQuantity = $hasQuantity
    hasDate = $hasDate
    sourceLat = $sourcePoint.lat
    sourceLon = $sourcePoint.lon
    sourcePointOrigin = $sourcePoint.source
    targetLat = $targetPoint.lat
    targetLon = $targetPoint.lon
    targetPointOrigin = $targetPoint.source
  })
}

$entityPayload = New-Object "System.Collections.Generic.List[object]"
foreach ($entry in $companiesById.Values) {
  $entityPayload.Add($entry)
}
foreach ($entry in $facilitiesById.Values) {
  $entityPayload.Add($entry)
}

$commodityTypeSet = New-Object "System.Collections.Generic.HashSet[string]"
foreach ($commodity in $commoditiesById.Values) {
  foreach ($type in $commodity.commodityTypes) {
    [void]$commodityTypeSet.Add($type)
  }
}

$payload = [ordered]@{
  meta = [ordered]@{
    title = "钴全球供应链知识图谱"
    subtitle = "GeoScene 风格知识图谱预览"
    builtAt = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    transactions = $transactionPayload.Count
    companies = $summary.companies
    facilities = $summary.facilities
    countries = $summary.countries
    mines = ($facilities | Where-Object { $_.display_name -eq "Mine" -or $_.facility_type -match "Mine" }).Count
    sourceDocuments = $summary.sources
  }
  stageOrder = $stageOrder
  stageColors = $stageColors
  focusCommodity = "钴"
  summary = $summary
  gapReport = [ordered]@{
    quantityRecords = $quantityRecords
    quantityCoverage = if ($transactionPayload.Count) { [math]::Round($quantityRecords / $transactionPayload.Count, 4) } else { 0 }
    dateRecords = $dateRecords
    dateCoverage = if ($transactionPayload.Count) { [math]::Round($dateRecords / $transactionPayload.Count, 4) } else { 0 }
    sourceBackedRecords = $sourceBackedRecords
    sourceCoverage = if ($transactionPayload.Count) { [math]::Round($sourceBackedRecords / $transactionPayload.Count, 4) } else { 0 }
    commodityBackedRecords = $commodityBackedRecords
    commodityCoverage = if ($transactionPayload.Count) { [math]::Round($commodityBackedRecords / $transactionPayload.Count, 4) } else { 0 }
    productCodeRecords = 0
    imageryRecords = 0
    exactFacilityCoordinateRecords = $transactionPayload.Count
  }
  operatorPairs = @($operatorPairs)
  commodityTypes = @($commodityTypeSet | Sort-Object)
  sources = @($sourcesById.Values | Sort-Object id)
  commodities = @($commoditiesById.Values | Sort-Object name)
  entities = @($entityPayload | Sort-Object type, name)
  transactions = @($transactionPayload)
}

$json = $payload | ConvertTo-Json -Depth 8 -Compress
$content = "window.COBALT_GEOSCENE_DATA = $json;"

$outputDir = Split-Path -Parent $outputPath
if (-not (Test-Path $outputDir)) {
  New-Item -ItemType Directory -Path $outputDir | Out-Null
}

Set-Content -Path $outputPath -Value $content -Encoding utf8
Write-Output "Wrote $outputPath"
