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
# Note: When using Leandix AI, selected business data (such as chat prompts, relevant model fields, or context-specific metadata) will be securely transmitted to a remote AI processing server (via API) for analysis and response generation. This allows AI services to understand your context and deliver accurate results.

{
    'name': 'Leandix AI',
    'version': '18.0.1.0.0',
    'summary': 'AI-powered insights and automation for Odoo',
    'description': """
    AI-powered insights and automation for Odoo.
    Note: When using Leandix AI, selected business data (such as chat prompts, relevant model fields, or context-specific metadata) will be securely transmitted to a remote AI processing server (via API) for analysis and response generation. This allows AI services to understand your context and deliver accurate results.
        """,
    'category': 'Extra Tools',
    'author': 'Canh Cam Solutions',
    'company': 'Canh Cam Solutions',
    'maintainer': 'Canh Cam Solutions',
    'website': 'https://leandix.com',
    'depends': ['base','web','base_setup'],
    'data': [
        'security/ir.model.access.csv',
        'views/chat.xml',
        'views/menu_items.xml',
        'views/leandix_setting.xml',
        'data/update_icon.xml',
    ],
    'assets': {
        'web.assets_backend': [
            'leandix_ai/static/src/js/container.xml',
            'leandix_ai/static/src/css/chat.css',
            'leandix_ai/static/src/css/description.css',
            'leandix_ai/static/src/js/chat.js',
        ]
    },
    "images": ["static/description/icon.png"],
    'installable': True,
    'application': True,
    'auto_install': False,
    'post_init_hook': 'setup_user_account',
    'license': 'Other proprietary'
}
