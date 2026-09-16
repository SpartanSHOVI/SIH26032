# AnnSetu — National Agricultural Commodity Taxonomy & Registry

This registry provides the official standardized commodity classification (605+ commodities across 16 primary agricultural groups) utilized across AnnSetu for:
1. **Farmer Registration**: Crop & harvest produce selection with group taxonomy.
2. **Mandi Token Issuance & Queueing**: APMC spot gate entry commodity classification.
3. **Statutory MSP & Floor Rates**: CACP/CCEA benchmark linkage and quality assay.
4. **Direct Benefit Transfer (DBT)**: Accurate scheme calculation per commodity group.

---

## Data Source
- **Standard**: Government of India Agmarknet / APMC Commodity Master
- **Raw Data File**: [`commodities.json`](./commodities.json) (or in API / Web data directories)
- **Total Registered Commodities**: 605 individual commodities
- **Total Primary Groups**: 16 functional categories

---

## Commodity Groups Breakdown

| Group ID | Commodity Group | Total Varieties | Sample Commodities |
|:---|:---|:---:|:---|
| `6` | **Vegetables** | 133 | Aloe Vera, Alsandikai, Amaranthus, Ambat Chuka, Amranthas Red |
| `5` | **Fruits** | 68 | Ambrette Seed/Muskmallow, Amla(Nelli Kai), Apple, Apricot(Jardalu/Khumani), Avocado |
| `14` | **Flowers** | 60 | Anthorium, Astera, BOP, Begonia, Calendula |
| `10` | **Others** | 55 | Ajwain Husk, Bran, Bunch Beans, Camel Hair, Cashew Kernnel |
| `12` | **Forest Products** | 46 | Absinthe, Ambada Seed, Antawala, Bamboo, Bay leaf(Tejpatta) |
| `11` | **Drug and Narcotics** | 41 | Arecanut(Betelnut/Supari), Asalia, Ashoka, Ashwagandha, Asparagus |
| `2` | **Pulses** | 37 | Alasande Gram, Avare Dal, Beans, Bengal Gram Dal(Chana Dal), Bengal Gram(Gram)(Whole) |
| `7` | **Spices** | 33 | Ajwan, Asgand, Betelnuts, Black pepper, Cardamom |
| `1` | **Cereals** | 30 | Bajra(Pearl Millet/Cumbu), Barley(Jau), Barnyard Millet, Basmati Rice, Beaten Rice |
| `16` | **Medicinal and Aromatic Plants** | 29 | Adulsa, Akarkara, Aloe Vera Leaf, Amaltas, Amarbel |
| `3` | **Oil Seeds** | 23 | Castor Seed, Coconut Seed, Copra, Cotton Seed, Ground Nut Seed |
| `13` | **Live Stock,Poultry,Fisheries** | 21 | Bull, Calf, Cock, Cow, Crab |
| `8` | **Dry Fruits** | 11 | Almond(Badam), Cashewnuts, Chest Nut, Dates, Dry Grapes |
| `15` | **Oils and Fats** | 8 | Butter, Castor Oil, Coconut Oil, Dalda, Ghee |
| `4` | **Fibre Crops** | 5 | Ambady/Mesta/Patson, Cotton, Jute, Lint, Sanai/Sunhemp |
| `9` | **Beverages** | 5 | Chicory(Chikori/Kasni), Cocoa, Coffee, Green Tea, Tea |

---

## Integration in AnnSetu

- **API Endpoint**: `GET /api/v1/locations/commodities` (supports `?group=`, `?search=`, `?msp_only=true`)
- **API Group Endpoint**: `GET /api/v1/locations/commodities/groups`
- **Frontend Utility**: `apps/web/src/utils/commodityUtils.ts`
- **Farmer Portal**: Crop selection categorized by Group in `Register.tsx`
- **APMC Mandi Staff**: Spot booking crop selector in `CenterDashboard.tsx`
- **Nodal Officer**: Statutory MSP inscription & bonus overlays in `AdminDashboard.tsx`
