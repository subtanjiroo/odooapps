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
import logging

_logger = logging.getLogger(__name__)

class MenuIconUpdater(models.Model):
    _name = 'leandix.ai.menu.icon.updater'
    _description = 'Menu Icon Updater'

    @api.model
    def update_menu_icon(self):
        try:
            menu = self.env['ir.ui.menu'].sudo().search([('name', '=', 'Leandix AI')], limit=1)
            icon_path = "leandix_ai,static/description/icon.png"
            if menu:
                menu.write({'web_icon': icon_path})
                _logger.info("Cập nhật icon thành công.")
            else:
                _logger.warning("Menu 'Leandix AI' không tìm thấy.")
        except Exception as e:
            _logger.warning("Lỗi cập nhật icon: %s", e)
