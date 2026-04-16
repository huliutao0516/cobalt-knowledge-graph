$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$outFile = Join-Path $root 'assets\cobalt_geoscene_data.js'

function Split-List([string]$value) {
  if ([string]::IsNullOrWhiteSpace($value)) { return @() }
  return @($value -split '\s*;\s*' | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | ForEach-Object { $_.Trim() })
}

function To-Num([string]$value) {
  if ([string]::IsNullOrWhiteSpace($value)) { return $null }
  return [double]::Parse($value, [System.Globalization.CultureInfo]::InvariantCulture)
}

function Has-Any([object[]]$values) {
  foreach ($value in $values) {
    if ($null -eq $value) { continue }
    if ($value -is [string]) {
      if (-not [string]::IsNullOrWhiteSpace($value)) { return $true }
    } else {
      return $true
    }
  }
  return $false
}

function Tx-Key($row) {
  if ($row.transaction_id) { return $row.transaction_id.Trim() }
  if ($row.start_id -like 'transaction::*') { return $row.start_id.Substring(13) }
  if ($row.end_id -like 'transaction::*') { return $row.end_id.Substring(13) }
  return $null
}

function Rel-First($rows, [string]$type) {
  return $rows | Where-Object { $_.type -eq $type } | Select-Object -First 1
}

$script:ChainStepMap = @{}
function Stage-Name([string]$nodeId) {
  if (-not $nodeId) { return $null }
  if ($script:ChainStepMap.ContainsKey($nodeId)) { return $script:ChainStepMap[$nodeId] }
  $name = $nodeId.Substring(12).Replace('-', ' ').ToLowerInvariant()
  return $name.Substring(0, 1).ToUpperInvariant() + $name.Substring(1)
}

function Resolve-Point($facility, $company, $countries) {
  if ($facility -and $null -ne $facility.lat -and $null -ne $facility.lon) {
    return [ordered]@{ lat = $facility.lat; lon = $facility.lon; source = 'facility' }
  }
  if ($company -and $null -ne $company.lat -and $null -ne $company.lon) {
    return [ordered]@{ lat = $company.lat; lon = $company.lon; source = 'company' }
  }
  $country = if ($facility) { $facility.country } else { $company.country }
  if ($country -and $countries.ContainsKey($country)) {
    $item = $countries[$country]
    if ($null -ne $item.lat -and $null -ne $item.lon) {
      return [ordered]@{ lat = $item.lat; lon = $item.lon; source = 'country' }
    }
  }
  return $null
}

$companies = Import-Csv (Join-Path $root 'companies.csv')
$facilities = Import-Csv (Join-Path $root 'facilities.csv')
$countries = Import-Csv (Join-Path $root 'countries.csv')
$commodities = Import-Csv (Join-Path $root 'commodities.csv')
$chainSteps = Import-Csv (Join-Path $root 'chain_steps.csv')
$sources = Import-Csv (Join-Path $root 'sources.csv')
$transactions = Import-Csv (Join-Path $root 'transactions.csv')
$relationships = Import-Csv (Join-Path $root 'relationships.csv')
$summary = Get-Content (Join-Path $root 'summary.json') -Raw | ConvertFrom-Json

$companyMap = @{}
$facilityMap = @{}
$countryMap = @{}
$commodityMap = @{}
$sourceMap = @{}
$relMap = @{}
$operatorPairs = New-Object System.Collections.Generic.List[object]

foreach ($row in $countries) {
  $countryMap[$row.name] = [ordered]@{
    id = $row.node_id
    name = $row.name
    lat = To-Num $row.lat
    lon = To-Num $row.lon
  }
}

foreach ($row in $chainSteps) {
  $script:ChainStepMap[$row.node_id] = $row.name
}

foreach ($row in $companies) {
  $companyMap[$row.node_id] = [ordered]@{
    id = $row.node_id
    type = 'company'
    name = $row.name
    searchLabel = $row.name
    country = $row.country_name
    lat = To-Num $row.lat
    lon = To-Num $row.lon
    roleTags = @(Split-List $row.role_tags)
    companyTypeTags = @(Split-List $row.company_type_tags)
  }
}

foreach ($row in $facilities) {
  $facilityMap[$row.node_id] = [ordered]@{
    id = $row.node_id
    type = 'facility'
    name = $row.name
    displayName = $row.display_name
    searchLabel = @($row.display_name, $row.country_name, $row.place | Where-Object { $_ }) -join ' | '
    country = $row.country_name
    facilityType = $row.facility_type
    lat = To-Num $row.lat
    lon = To-Num $row.lon
    place = $row.place
  }
}

foreach ($row in $commodities) {
  $commodityMap[$row.node_id] = [ordered]@{
    id = $row.node_id
    name = $row.name
    commodityTypes = @(Split-List $row.commodity_types)
    directionTags = @(Split-List $row.direction_tags)
  }
}

foreach ($row in $sources) {
  $sourceMap[$row.node_id] = [ordered]@{
    id = $row.node_id
    url = $row.url
    host = $row.host
  }
}

foreach ($row in $relationships) {
  if ($row.type -eq 'OPERATES_FACILITY') {
    $operatorPairs.Add([ordered]@{ companyId = $row.start_id; facilityId = $row.end_id; side = $row.side })
  }
  $key = Tx-Key $row
  if ($key) {
    if (-not $relMap.ContainsKey($key)) { $relMap[$key] = @() }
    $relMap[$key] += $row
  }
}

$stageOrder = @(
  'Artisanal mining',
  'Mining',
  'Artisanal processing',
  'Smelting',
  'Refining',
  'Trading',
  'Precursor manufacturing',
  'Cathode manufacturing',
  'Battery cell manufacturing',
  'Battery pack manufacturing',
  'Electric car manufacturing',
  'Electric scooter manufacturing',
  'Recycling'
)

$stageColors = [ordered]@{
  'Artisanal mining' = '#53b7ff'
  'Mining' = '#3de2d8'
  'Artisanal processing' = '#50f09c'
  'Smelting' = '#8fff68'
  'Refining' = '#d6ff56'
  'Trading' = '#ffd85a'
  'Precursor manufacturing' = '#ffae57'
  'Cathode manufacturing' = '#ff7d7d'
  'Battery cell manufacturing' = '#ff64c8'
  'Battery pack manufacturing' = '#d18bff'
  'Electric car manufacturing' = '#7ab6ff'
  'Electric scooter manufacturing' = '#4fb0ff'
  'Recycling' = '#52e6bf'
}

$txItems = New-Object System.Collections.Generic.List[object]
foreach ($tx in $transactions) {
  if (-not $tx.transaction_id) { continue }

  $rows = @($relMap[$tx.transaction_id])
  $supply = Rel-First $rows 'SUPPLIES_TO'
  $supIn = Rel-First $rows 'SUPPLIER_IN'
  $buyIn = Rel-First $rows 'BUYER_IN'
  $supFacRel = Rel-First $rows 'SUPPLIER_FACILITY'
  $buyFacRel = Rel-First $rows 'BUYER_FACILITY'
  $inputStage = Rel-First $rows 'INPUT_CHAIN_STEP'
  $outputStage = Rel-First $rows 'OUTPUT_CHAIN_STEP'

  $supCompanyId = if ($supIn) { $supIn.start_id } elseif ($supply) { $supply.start_id } else { $null }
  $buyCompanyId = if ($buyIn) { $buyIn.start_id } elseif ($supply) { $supply.end_id } else { $null }
  $supFacilityId = if ($supFacRel) { $supFacRel.end_id } else { $null }
  $buyFacilityId = if ($buyFacRel) { $buyFacRel.end_id } else { $null }

  $supCompany = if ($companyMap.ContainsKey($supCompanyId)) { $companyMap[$supCompanyId] } else { $null }
  $buyCompany = if ($companyMap.ContainsKey($buyCompanyId)) { $companyMap[$buyCompanyId] } else { $null }
  $supFacility = if ($facilityMap.ContainsKey($supFacilityId)) { $facilityMap[$supFacilityId] } else { $null }
  $buyFacility = if ($facilityMap.ContainsKey($buyFacilityId)) { $facilityMap[$buyFacilityId] } else { $null }

  $from = Resolve-Point $supFacility $supCompany $countryMap
  $to = Resolve-Point $buyFacility $buyCompany $countryMap
  if (-not $from -or -not $to) { continue }

  $inputCommodityIds = @($rows | Where-Object { $_.type -eq 'INPUT_COMMODITY' } | ForEach-Object { $_.end_id } | Where-Object { $_ })
  $outputCommodityIds = @($rows | Where-Object { $_.type -eq 'OUTPUT_COMMODITY' } | ForEach-Object { $_.end_id } | Where-Object { $_ })
  $sourceIds = @($rows | Where-Object { $_.type -eq 'SUPPORTED_BY' } | ForEach-Object { $_.end_id } | Where-Object { $_ })
  $notes = @($tx.notes, $tx.notes1, $tx.transaction_notes | Where-Object { $_ })
  $hasQuantity = Has-Any @(
    $tx.amount_tonnes_raw,
    $tx.amount_tonnes_value,
    $tx.amount_units_raw,
    $tx.amount_units_value,
    $tx.amount_usd_raw,
    $tx.amount_usd_value,
    $tx.amount_yuan_raw,
    $tx.amount_yuan_value,
    $tx.amount_energy_units_raw,
    $tx.amount_energy_units_value
  )
  $hasDate = Has-Any @($tx.date_of_transaction, $tx.expected_date_of_transaction)

  $txItems.Add([ordered]@{
    id = $tx.transaction_id
    nodeId = $tx.node_id
    supplierCompanyId = $supCompanyId
    supplierCompany = $supCompany.name
    buyerCompanyId = $buyCompanyId
    buyerCompany = $buyCompany.name
    supplierFacilityId = $supFacilityId
    supplierFacility = $supFacility.searchLabel
    buyerFacilityId = $buyFacilityId
    buyerFacility = $buyFacility.searchLabel
    supplierCountry = if ($supFacility) { $supFacility.country } else { $supCompany.country }
    buyerCountry = if ($buyFacility) { $buyFacility.country } else { $buyCompany.country }
    supplierStage = Stage-Name $inputStage.end_id
    buyerStage = Stage-Name $outputStage.end_id
    chainLink = $tx.link_in_chain
    inputCommodityIds = $inputCommodityIds
    inputCommodities = @($inputCommodityIds | ForEach-Object { if ($commodityMap.ContainsKey($_)) { $commodityMap[$_].name } } | Where-Object { $_ })
    outputCommodityIds = $outputCommodityIds
    outputCommodities = @($outputCommodityIds | ForEach-Object { if ($commodityMap.ContainsKey($_)) { $commodityMap[$_].name } } | Where-Object { $_ })
    sourceIds = $sourceIds
    sourceCount = $sourceIds.Count
    amountTonnesRaw = $tx.amount_tonnes_raw
    amountTonnesValue = if ($tx.amount_tonnes_value) { [double]$tx.amount_tonnes_value } else { $null }
    amountUnitsRaw = $tx.amount_units_raw
    amountUnitsValue = if ($tx.amount_units_value) { [double]$tx.amount_units_value } else { $null }
    amountUsdRaw = $tx.amount_usd_raw
    amountUsdValue = if ($tx.amount_usd_value) { [double]$tx.amount_usd_value } else { $null }
    amountYuanRaw = $tx.amount_yuan_raw
    amountYuanValue = if ($tx.amount_yuan_value) { [double]$tx.amount_yuan_value } else { $null }
    amountEnergyRaw = $tx.amount_energy_units_raw
    amountEnergyValue = if ($tx.amount_energy_units_value) { [double]$tx.amount_energy_units_value } else { $null }
    date = $tx.date_of_transaction
    expectedDate = $tx.expected_date_of_transaction
    realised = $tx.transaction_realised
    notes = $notes
    hasQuantity = $hasQuantity
    hasDate = $hasDate
    sourceLat = $from.lat
    sourceLon = $from.lon
    sourcePointOrigin = $from.source
    targetLat = $to.lat
    targetLon = $to.lon
    targetPointOrigin = $to.source
  })
}

$overridePath = Join-Path $root 'data\tenke_kfm_override.json'
if (Test-Path $overridePath) {
  $override = Get-Content $overridePath -Raw | ConvertFrom-Json
  $replaceCompanyIds = @($override.replaceCompanyIds | ForEach-Object { "$_" })

  if ($replaceCompanyIds.Count) {
    $filteredTxItems = New-Object System.Collections.Generic.List[object]
    foreach ($item in $txItems) {
      if ($replaceCompanyIds -contains $item.supplierCompanyId -or $replaceCompanyIds -contains $item.buyerCompanyId) {
        continue
      }
      $filteredTxItems.Add($item)
    }
    $txItems = $filteredTxItems

    $filteredOperatorPairs = New-Object System.Collections.Generic.List[object]
    foreach ($pair in $operatorPairs) {
      if ($replaceCompanyIds -contains $pair.companyId) { continue }
      $filteredOperatorPairs.Add($pair)
    }
    $operatorPairs = $filteredOperatorPairs
  }

  foreach ($source in @($override.sources)) {
    if (-not $source) { continue }
    $sourceMap["$($source.id)"] = [ordered]@{
      id = "$($source.id)"
      url = "$($source.url)"
      host = "$($source.host)"
    }
  }

  foreach ($entity in @($override.entities)) {
    if (-not $entity) { continue }
    $entry = [ordered]@{
      id = "$($entity.id)"
      type = "$($entity.type)"
      name = "$($entity.name)"
      searchLabel = if ($entity.searchLabel) { "$($entity.searchLabel)" } else { "$($entity.name)" }
      country = "$($entity.country)"
      lat = if ($null -ne $entity.lat) { [double]$entity.lat } else { $null }
      lon = if ($null -ne $entity.lon) { [double]$entity.lon } else { $null }
      roleTags = @($entity.roleTags | ForEach-Object { "$_" })
      companyTypeTags = @($entity.companyTypeTags | ForEach-Object { "$_" })
    }
    if ($entry.type -eq 'facility') {
      $entry.displayName = if ($entity.displayName) { "$($entity.displayName)" } else { "$($entity.name)" }
      $entry.facilityType = "$($entity.facilityType)"
      $entry.place = "$($entity.place)"
      $facilityMap[$entry.id] = $entry
    } else {
      $companyMap[$entry.id] = $entry
    }
  }

  foreach ($pair in @($override.operatorPairs)) {
    if (-not $pair) { continue }
    $operatorPairs.Add([ordered]@{
      companyId = "$($pair.companyId)"
      facilityId = "$($pair.facilityId)"
      side = "$($pair.side)"
    })
  }

  foreach ($tx in @($override.transactions)) {
    if (-not $tx) { continue }
    $txItems.Add([ordered]@{
      id = "$($tx.id)"
      nodeId = "$($tx.nodeId)"
      supplierCompanyId = "$($tx.supplierCompanyId)"
      supplierCompany = "$($tx.supplierCompany)"
      buyerCompanyId = "$($tx.buyerCompanyId)"
      buyerCompany = "$($tx.buyerCompany)"
      supplierFacilityId = "$($tx.supplierFacilityId)"
      supplierFacility = "$($tx.supplierFacility)"
      buyerFacilityId = "$($tx.buyerFacilityId)"
      buyerFacility = "$($tx.buyerFacility)"
      supplierCountry = "$($tx.supplierCountry)"
      buyerCountry = "$($tx.buyerCountry)"
      supplierStage = "$($tx.supplierStage)"
      buyerStage = "$($tx.buyerStage)"
      chainLink = "$($tx.chainLink)"
      inputCommodityIds = @($tx.inputCommodityIds | ForEach-Object { "$_" })
      inputCommodities = @($tx.inputCommodities | ForEach-Object { "$_" })
      outputCommodityIds = @($tx.outputCommodityIds | ForEach-Object { "$_" })
      outputCommodities = @($tx.outputCommodities | ForEach-Object { "$_" })
      sourceIds = @($tx.sourceIds | ForEach-Object { "$_" })
      sourceCount = if ($null -ne $tx.sourceCount) { [int]$tx.sourceCount } else { 0 }
      amountTonnesRaw = "$($tx.amountTonnesRaw)"
      amountTonnesValue = if ($null -ne $tx.amountTonnesValue) { [double]$tx.amountTonnesValue } else { $null }
      amountUnitsRaw = "$($tx.amountUnitsRaw)"
      amountUnitsValue = if ($null -ne $tx.amountUnitsValue) { [double]$tx.amountUnitsValue } else { $null }
      amountUsdRaw = "$($tx.amountUsdRaw)"
      amountUsdValue = if ($null -ne $tx.amountUsdValue) { [double]$tx.amountUsdValue } else { $null }
      amountYuanRaw = "$($tx.amountYuanRaw)"
      amountYuanValue = if ($null -ne $tx.amountYuanValue) { [double]$tx.amountYuanValue } else { $null }
      amountEnergyRaw = "$($tx.amountEnergyRaw)"
      amountEnergyValue = if ($null -ne $tx.amountEnergyValue) { [double]$tx.amountEnergyValue } else { $null }
      date = "$($tx.date)"
      expectedDate = "$($tx.expectedDate)"
      realised = "$($tx.realised)"
      notes = @($tx.notes | ForEach-Object { "$_" })
      hasQuantity = [bool]$tx.hasQuantity
      hasDate = [bool]$tx.hasDate
      sourceLat = if ($null -ne $tx.sourceLat) { [double]$tx.sourceLat } else { $null }
      sourceLon = if ($null -ne $tx.sourceLon) { [double]$tx.sourceLon } else { $null }
      sourcePointOrigin = "$($tx.sourcePointOrigin)"
      targetLat = if ($null -ne $tx.targetLat) { [double]$tx.targetLat } else { $null }
      targetLon = if ($null -ne $tx.targetLon) { [double]$tx.targetLon } else { $null }
      targetPointOrigin = "$($tx.targetPointOrigin)"
    })
  }
}

$entities = @($companyMap.Values) + @($facilityMap.Values)
$operatorPairsOut = @($operatorPairs | ForEach-Object { $_ })
$transactionsOut = @($txItems | ForEach-Object { $_ })
$commodityTypes = New-Object System.Collections.Generic.HashSet[string]
foreach ($commodity in $commodityMap.Values) {
  foreach ($type in @($commodity.commodityTypes)) {
    if ($type) { [void]$commodityTypes.Add($type) }
  }
}

$quantityRecords = @($txItems | Where-Object { $_.hasQuantity }).Count
$dateRecords = @($txItems | Where-Object { $_.hasDate }).Count
$sourceRecords = @($txItems | Where-Object { $_.sourceCount -gt 0 }).Count
$commodityRecords = @($txItems | Where-Object { $_.inputCommodityIds.Count -gt 0 -or $_.outputCommodityIds.Count -gt 0 }).Count
$exactFacilityCoordinateRecords = @($txItems | Where-Object { $_.sourcePointOrigin -eq 'facility' -and $_.targetPointOrigin -eq 'facility' }).Count

$payload = [ordered]@{
  meta = [ordered]@{
    title = 'Cobalt Global Supply Chain Knowledge Graph'
    subtitle = 'GeoScene-style knowledge graph preview'
    builtAt = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
    transactions = $transactionsOut.Count
    companies = $summary.companies
    facilities = $summary.facilities
    countries = $summary.countries
    mines = ($facilities | Where-Object { $_.display_name -eq 'Mine' -or $_.facility_type -match 'Mine' }).Count
    sourceDocuments = $summary.sources
  }
  stageOrder = $stageOrder
  stageColors = $stageColors
  focusCommodity = 'Cobalt'
  summary = $summary
  gapReport = [ordered]@{
    quantityRecords = $quantityRecords
    quantityCoverage = if ($transactionsOut.Count) { ([double]$quantityRecords) / ([double]$transactionsOut.Count) } else { 0 }
    dateRecords = $dateRecords
    dateCoverage = if ($transactionsOut.Count) { ([double]$dateRecords) / ([double]$transactionsOut.Count) } else { 0 }
    sourceBackedRecords = $sourceRecords
    sourceCoverage = if ($transactionsOut.Count) { ([double]$sourceRecords) / ([double]$transactionsOut.Count) } else { 0 }
    commodityBackedRecords = $commodityRecords
    commodityCoverage = if ($transactionsOut.Count) { ([double]$commodityRecords) / ([double]$transactionsOut.Count) } else { 0 }
    productCodeRecords = 0
    imageryRecords = 0
    exactFacilityCoordinateRecords = $exactFacilityCoordinateRecords
  }
  operatorPairs = $operatorPairsOut
  commodityTypes = @($commodityTypes | Sort-Object)
  sources = @($sourceMap.Values | Sort-Object id)
  commodities = @($commodityMap.Values | Sort-Object name)
  entities = @($entities | Sort-Object type, name)
  transactions = $transactionsOut
}

$json = $payload | ConvertTo-Json -Depth 8 -Compress
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($outFile, "window.COBALT_GEOSCENE_DATA = $json;", $utf8NoBom)
Write-Output "Wrote $outFile"

