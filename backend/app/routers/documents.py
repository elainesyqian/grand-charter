"""/api/documents  -- any signed-in role.

GET /{document_id}   streams the PDF after policy.get_document_for(user, id) (404 otherwise).
                     Content-Type: application/pdf; Content-Disposition with a sanitized
                     filename; X-Content-Type-Options: nosniff.
"""
