# -*- coding: utf-8 -*-
#
# Copyright (c) 2025 CanhCamsSolutions
# All rights reserved.
# Licensed under the CanhCamsSolutions Proprietary License.
#
# You may modify the source code for internal use only,
# but you may NOT remove or alter the author or company name.
# Commercial use, resale, or redistribution is strictly prohibited.
#
# See LICENSE file for full license terms.


from odoo import models, api

class tools(models.Model):
    _name = 'leandix.tools'
    _description = 'tools for engine to use'

    @api.model
    def update_record(self, model_name, record_id, field_values):
        try:
            rec = self.env[model_name].browse(record_id)
            if not rec.exists():
                return {'success': False, 'error': 'Record not found'}
            rec.write(field_values)
            return {'success': True}
        except Exception as e:
            return {'success': False, 'error': str(e)}
