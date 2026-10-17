# SOC Calculator — Netmask

The base is the FortiSIEM MSSP licensing calculator built by the SOC lead (`core.py`, `storage.py`, `ui.py`, `data/precios.json`, `data/reglas.json`). On top of it sits `precio_soc.py`, which estimates **what to charge clients for the SOC service** so that it **reaches break-even with 3 clients**.

## Pricing model

- **SOC base plan (monthly per client)**: incident management + platform, includes **25 devices** (`plan_base`).
- **OT vulnerability management module**: priced separately, covers the vulnerability team's cost.
- **Additional device / agent**: tier-1 FortiSIEM license cost (the most expensive) / (1 − margin).
- **Collector (optional, billed outside the plan)**: client VM or server (no cost), industrial NUC USD 1,500 financed in 6 installments (USD 250/month), or a collector in Azure (USD 200/month).

Monthly cost with N clients:

```
personnel (salary COP × benefits load factor / exchange rate) + on-call
+ fixed costs (Azure base for 2 VMs USD 400, tools)
+ FortiSIEM annual program fee / 12 (USD 5,000 / 12)
+ FortiSIEM licenses on the aggregate devices of all clients (core.py engine)
+ N × variable cost per client (Azure storage USD 200)
+ contingency 10%
```

Break-even price = cost(3) / 3, rounded up to multiples of USD 50.

## Usage

```bash
python precio_soc.py                       # "completo" scenario, 3 clients
python precio_soc.py --escenario esbelto   # minimal team
python precio_soc.py --clientes 4
python -m unittest discover -s tests -p "test_*.py"
```

All assumptions live in `data/supuestos_soc.json`. Entries marked `"origen": "supuesto"` are estimates that need to be replaced with real payroll figures. The generated reports are in `docs/`.

## Notes on the sources

- The licensing engine applies **mandatory minimums** (50 devices, 50 agents, 25 UEBA). That puts a floor of USD 1,655/month in licenses even with 0 agents and 0 UEBA. Fortinet's Business Case Excel does not apply them (it prices 20 devices in Year 1), so this should be confirmed with Fortinet.
- Pricing tiers apply **a single rate to every unit** of the aggregate: going from 150 to 175 devices lowers the price from 25.52 to 20.01 per device. That is why the total cost drops between 6 and 7 clients.
- Fortinet's Business Case projects 20 / 50 / 150 devices for years 1, 2 and 3. Three clients on the base plan already add up to 75 devices, so the projection should be updated.
- In the Business Case Excel, the agent formula maps the 51–150 range to the price in row 88 (USD 2.97, the 1K SKU) because the rows are not sorted. The `core.py` engine uses the correct price (USD 4.97).
