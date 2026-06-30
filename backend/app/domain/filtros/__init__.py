"""Sistema de filtros dinâmicos (spec 002-filtros-dinamicos).

`registry` declara os campos filtráveis (fonte da verdade backend); `engine` parseia os
query params e aplica os predicados. O escopo R-001 é aplicado ANTES, fora daqui — o
filtro de UI nunca amplia escopo.
"""
