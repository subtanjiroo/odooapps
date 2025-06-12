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



from odoo import models, fields


class chat_message(models.Model):
    _name = 'leandix.ai.chat.message'
    _description = 'This message store the chat message between user and bot'

    message = fields.Char(string='Message')
    role = fields.Selection([
        ('user', 'User'),
        ('system', 'System')
    ], string='Role')
    chat_id = fields.Many2one('leandix.ai.chat.history', string='Chat ID')





