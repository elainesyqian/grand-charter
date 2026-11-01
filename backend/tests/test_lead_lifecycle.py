"""Accept/decline/assign rules: accept creates exactly one case; double accept -> 409;
decline after accept -> 409; decline requires reason and removes firm access; admin can
assign unassigned/declined leads; admin can't use lead-assign on accepted leads; assigning
to the same firm -> 409."""
