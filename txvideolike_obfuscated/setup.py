from setuptools import setup, find_packages

setup(
    name="txvideolike_obfuscated",
    version="1.0.0",
    packages=find_packages(),
    install_requires=[
        "requests",
    ],
    entry_points={
        'console_scripts': [
            'txvideolike=txvideolike_obfuscated.cli:main',
        ],
    },
) 